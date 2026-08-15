# Applying Skill: agent-memory-systems from Path 1
# Applying Skill: memory-systems from Path 1
# Applying Skill: obsidian-markdown from Path 1

import os
import re
import yaml
from datetime import datetime, date

class MemoryGraphLinker:
    """
    Stateless utility class for managing Obsidian memory vault metadata,
    generating YAML Frontmatter (Types A, B, C), and auto-linking graph nodes.
    """
    def __init__(self, vault_path: str):
        self.vault_path = os.path.abspath(vault_path)
        self.logs_dir = os.path.join(self.vault_path, "Memory", "Daily Logs")
        
    def get_all_nodes(self) -> dict[str, str]:
        """
        Scans the vault to find all markdown nodes.
        Returns a dictionary mapping lowercase node_name to absolute path.
        """
        nodes = {}
        for root_name in ["Memory", "System_Data", "Developer"]:
            sub_dir = os.path.join(self.vault_path, root_name)
            if not os.path.exists(sub_dir):
                continue
            for root, _, files in os.walk(sub_dir):
                for f in files:
                    if f.endswith(".md"):
                        node_name = f[:-3]
                        nodes[node_name.lower()] = os.path.join(root, f)
        return nodes

    def resolve_link(self, node_name: str, known_nodes: dict = None) -> str:
        """
        Resolves a node name to a bi-directional link format [[Node Name]].
        Falls back to [[Unresolved Code Context]] if the node does not exist.
        """
        if not known_nodes:
            known_nodes = self.get_all_nodes()
            
        clean_name = node_name.strip("[] ").lower()
        if clean_name in known_nodes:
            # Return proper case name of the existing file
            existing_path = known_nodes[clean_name]
            actual_name = os.path.basename(existing_path)[:-3]
            return f"[[{actual_name}]]"
        return "[[Unresolved Code Context]]"

    def find_previous_session(self, current_date_str: str) -> str:
        """
        Scans Daily Logs to find the chronologically previous session node.
        """
        try:
            current_date = date.fromisoformat(current_date_str)
        except ValueError:
            current_date = date.today()

        if not os.path.exists(self.logs_dir):
            return "[[Unresolved Code Context]]"

        log_dates = []
        for f in os.listdir(self.logs_dir):
            if f.endswith(".md") and re.match(r"^\d{4}-\d{2}-\d{2}\.md$", f):
                name = f[:-3]
                try:
                    d = date.fromisoformat(name)
                    if d < current_date:
                        log_dates.append(d)
                except ValueError:
                    pass

        if log_dates:
            previous_date = max(log_dates)
            return f"[[{previous_date.isoformat()}]]"
        return "[[Unresolved Code Context]]"

    # --- Parser & Serializer ---

    def parse_file(self, path: str) -> tuple[dict, str]:
        """
        Reads a file, parsing its YAML frontmatter and returning (metadata, body).
        """
        if not os.path.exists(path):
            return {}, ""
            
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        except IOError:
            return {}, ""

        match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        if not match:
            return {}, content

        yaml_text = match.group(1)
        body = content[match.end():]

        try:
            metadata = yaml.safe_load(yaml_text) or {}
        except Exception:
            # Fallback manual parser if yaml library fails
            metadata = {}
            for line in yaml_text.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    metadata[k.strip()] = v.strip()

        return metadata, body

    def write_file(self, path: str, metadata: dict, body: str):
        """
        Writes a file with structured frontmatter and body.
        """
        # Ensure directories exist
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        # Serialize to clean YAML format
        yaml_text = yaml.safe_dump(metadata, sort_keys=False, default_flow_style=False).strip()
        content = f"---\n{yaml_text}\n---\n{body.lstrip()}"

        import time
        retries = 10
        delay = 0.1
        for i in range(retries):
            temp_path = path + f".{i}.tmp"
            try:
                with open(temp_path, "w", encoding="utf-8") as f:
                    f.write(content)
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except OSError:
                        time.sleep(delay)
                        if os.path.exists(path):
                            os.remove(path)
                os.rename(temp_path, path)
                return
            except OSError as e:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass
                if i == retries - 1:
                    raise e
                time.sleep(delay)

    # --- Frontmatter Type Enforcers ---

    def enforce_session_frontmatter(self, current_date_str: str, existing_metadata: dict = None) -> dict:
        """
        Generates/enforces TYPE A: Session Nodes frontmatter.
        """
        meta = existing_metadata.copy() if existing_metadata else {}
        
        previous = self.find_previous_session(current_date_str)
        
        meta.setdefault("type", "dev-session")
        meta["timestamp"] = datetime.now().isoformat()
        meta["previous_session"] = previous
        meta.setdefault("active_branch", "main")
        
        # Keep other existing fields
        meta.setdefault("date", current_date_str)
        meta.setdefault("session_count", 1)
        meta.setdefault("interaction_count", 0)
        meta.setdefault("memory_candidates", 0)
        meta.setdefault("generated_by", "JARVIS")
        meta.setdefault("consolidated", False)
        
        return meta

    def enforce_task_frontmatter(self, existing_metadata: dict = None, origin_session_str: str = None) -> dict:
        """
        Generates/enforces TYPE B: Task / Issue Nodes frontmatter.
        """
        meta = existing_metadata.copy() if existing_metadata else {}
        known_nodes = self.get_all_nodes()
        
        origin = "[[Unresolved Code Context]]"
        if origin_session_str:
            origin = self.resolve_link(origin_session_str, known_nodes)
        elif "origin_session" in meta:
            origin = self.resolve_link(meta["origin_session"], known_nodes)

        meta.setdefault("type", "dev-task")
        meta.setdefault("status", "in-progress")
        meta["origin_session"] = origin
        
        # Check epic and other task dependencies
        meta["parent_epic"] = self.resolve_link(meta.get("parent_epic", "Unresolved Code Context"), known_nodes)
        meta["blocks_task"] = self.resolve_link(meta.get("blocks_task", "Unresolved Code Context"), known_nodes)
        meta["requires_task"] = self.resolve_link(meta.get("requires_task", "Unresolved Code Context"), known_nodes)
        
        return meta

    def enforce_architecture_frontmatter(self, category: str, existing_metadata: dict = None, affected_files: list = None) -> dict:
        """
        Generates/enforces TYPE C: System Instructions & Architecture frontmatter.
        """
        meta = existing_metadata.copy() if existing_metadata else {}
        known_nodes = self.get_all_nodes()

        meta.setdefault("type", "architecture")
        meta["category"] = category
        meta["supersedes"] = self.resolve_link(meta.get("supersedes", "Unresolved Code Context"), known_nodes)
        meta["complements"] = self.resolve_link(meta.get("complements", "Unresolved Code Context"), known_nodes)
        meta["affected_files"] = meta.get("affected_files", affected_files or [])
        
        return meta

    def enforce_file_frontmatter(self, existing_metadata: dict = None) -> dict:
        """
        Generates/enforces frontmatter for workspace file nodes.
        """
        meta = existing_metadata.copy() if existing_metadata else {}
        meta.setdefault("type", "file")
        meta.setdefault("category", "workspace-file")
        meta.setdefault("path", "")
        return meta

    def enforce_folder_frontmatter(self, existing_metadata: dict = None) -> dict:
        """
        Generates/enforces frontmatter for workspace folder nodes.
        """
        meta = existing_metadata.copy() if existing_metadata else {}
        meta.setdefault("type", "folder")
        meta.setdefault("category", "workspace-folder")
        meta.setdefault("path", "")
        return meta

    def connect_child_to_parent_folder(self, body: str, parent_folder_name: str) -> str:
        """
        Ensures the body contains a link back to its parent folder.
        """
        link_str = f"[[{parent_folder_name}]]"
        if link_str not in body:
            body = body.rstrip() + f"\n\nParent: {link_str}\n"
        return body

    def sync_folder_hierarchies(self):
        for root_name in ["Memory", "System_Data", "Developer"]:
            root_dir = os.path.join(self.vault_path, root_name)
            if not os.path.exists(root_dir):
                continue
                
            subfolders = []
            for item in os.listdir(root_dir):
                full_path = os.path.join(root_dir, item)
                if os.path.isdir(full_path) and not item.startswith(".") and item != "scripts":
                    subfolders.append(item)
                    
            # Ensure root node [RootName].md exists in root_dir
            root_node_path = os.path.join(root_dir, f"{root_name}.md")
            root_metadata = {
                "type": "folder",
                "path": root_name,
                "category": "root-folder"
            }
            root_body = f"# {root_name}\n\n## Subfolders\n"
            for sub in sorted(subfolders):
                root_body += f"- [[{sub}]]\n"
            self.write_file(root_node_path, root_metadata, root_body)
            
            # For each subfolder, create an index note in root_dir
            for sub in subfolders:
                sub_dir = os.path.join(root_dir, sub)
                sub_node_path = os.path.join(root_dir, f"{sub}.md")
                
                # Find all markdown files inside this subfolder
                contents = []
                for f in os.listdir(sub_dir):
                    if f.endswith(".md"):
                        contents.append(f[:-3])
                        
                sub_metadata = {
                    "type": "folder",
                    "path": f"{root_name}/{sub}",
                    "category": "subfolder"
                }
                sub_body = f"# {sub}\n\nParent: [[{root_name}]]\n\n## Contents\n"
                if contents:
                    for item in sorted(contents):
                        sub_body += f"- [[{item}]]\n"
                else:
                    sub_body += "- None\n"
                self.write_file(sub_node_path, sub_metadata, sub_body)

    def sync_memory_folders(self):
        """
        Scans all subfolders in the Memory, System_Data, and Developer directories and creates/updates index nodes
        for them to establish hierarchy within the vault, deleting any external workspace files.
        """
        # Clean up any external Files directory we created previously
        files_dir = os.path.join(self.vault_path, "Memory", "Files")
        if os.path.exists(files_dir):
            import shutil
            try:
                shutil.rmtree(files_dir)
            except Exception as e:
                print(f"Failed to remove Files directory: {e}")

        # Run sync for each of the new folders
        self.sync_folder_hierarchies()

    def auto_link_body(self, body: str, current_node_name: str, known_nodes: dict[str, str]) -> str:
        """
        Scans the note body for references to other known nodes.
        Wraps found node names in double square brackets [[Node Name]],
        ignoring existing links.
        """
        # Sort known nodes by length of their name descending to match longer titles first
        sorted_nodes = sorted(
            [(name, path) for name, path in known_nodes.items() if name != current_node_name.lower()],
            key=lambda x: len(x[0]),
            reverse=True
        )

        for lowercase_name, path in sorted_nodes:
            # We want to match the name as a whole word, case-insensitively.
            # Get the exact correct-casing name of the target file
            actual_name = os.path.basename(path)[:-3]
            
            # Escape name for regex
            escaped_name = re.escape(actual_name)
            
            # We want to replace it only if it is NOT already inside [[ ... ]]
            # Regex pattern to match either an existing link or the plain word
            pattern = re.compile(r"(\[\[[^\]]+?\]\])|(\b" + escaped_name + r"\b)", re.IGNORECASE)
            
            def replace_match(m):
                if m.group(1):
                    # It matched an existing link, return it unchanged
                    return m.group(1)
                else:
                    # It matched the plain word, wrap it in links
                    return f"[[{actual_name}]]"
            
            body = pattern.sub(replace_match, body)
            
        return body

    def enforce_all_vault_nodes(self):
        """
        Scans all files in the vault, enforcing compliant YAML Frontmatter for each category
        and auto-linking text bodies.
        """
        self.sync_memory_folders()
        known_nodes = self.get_all_nodes()
        for node_name, path in known_nodes.items():
            metadata, body = self.parse_file(path)
            basename = os.path.basename(path).lower()
            
            updated_metadata = metadata.copy()
            
            # Find which root folder it is in: Memory, System_Data, or Developer
            root_folder = ""
            for r in ["Memory", "System_Data", "Developer"]:
                if path.lower().startswith(os.path.join(self.vault_path, r).lower() + os.sep):
                    root_folder = r
                    break
            
            if root_folder:
                root_path = os.path.join(self.vault_path, root_folder)
                rel_dir = os.path.dirname(os.path.relpath(path, root_path)).replace("\\", "/")
            else:
                rel_dir = ""
                
            if rel_dir == ".":
                rel_dir = ""
            parent_folder = os.path.basename(rel_dir)
            
            # Identify category based on path and filename
            if "daily logs" in path.lower():
                log_date_str = basename[:-3]
                updated_metadata = self.enforce_session_frontmatter(log_date_str, metadata)
            elif "task memory" in path.lower():
                updated_metadata = self.enforce_task_frontmatter(metadata)
            elif "instruction memory" in path.lower():
                category = "system-prompt"
                if "lessons" in basename:
                    category = "design-pattern"
                updated_metadata = self.enforce_architecture_frontmatter(category=category, existing_metadata=metadata)
            elif "user preference memory" in path.lower():
                updated_metadata = self.enforce_architecture_frontmatter(category="configuration", existing_metadata=metadata)
            elif "personal details memory" in path.lower():
                updated_metadata = self.enforce_architecture_frontmatter(category="configuration", existing_metadata=metadata)
            elif rel_dir == "":
                # Root folder notes like Daily Logs.md, Task Memory.md, Memory.md, Developer.md, System_Data.md
                node_type = metadata.get("type", "folder")
                if node_type == "folder":
                    updated_metadata = self.enforce_folder_frontmatter(metadata)
                else:
                    updated_metadata = self.enforce_file_frontmatter(metadata)
            else:
                # Custom folder or general note
                # Enforce general architecture frontmatter, using the parent directory name as category
                updated_metadata = self.enforce_architecture_frontmatter(category=parent_folder.lower(), existing_metadata=metadata)
                
            # Connect note to parent folder if it's inside a subfolder
            updated_body = body
            if rel_dir != "" and parent_folder != "":
                parent_to_link = parent_folder if parent_folder else root_folder
                updated_body = self.connect_child_to_parent_folder(updated_body, parent_to_link)

            # Automatically scan and link body content references
            updated_body = self.auto_link_body(updated_body, node_name, known_nodes)
            
            if updated_metadata != metadata or updated_body != body or not updated_body.strip():
                # Enforce headers in bodies if empty
                if not updated_body.strip():
                    header_title = os.path.basename(path)[:-3]
                    updated_body = f"# {header_title}\n"
                self.write_file(path, updated_metadata, updated_body)


if __name__ == "__main__":
    import sys
    default_vault = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    vault = sys.argv[1] if len(sys.argv) > 1 else default_vault
    linker = MemoryGraphLinker(vault)
    linker.enforce_all_vault_nodes()
    print("Graph linking enforced successfully.")
