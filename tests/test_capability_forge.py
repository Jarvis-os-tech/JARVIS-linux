"""
Automated Verification Suite for J.A.R.V.I.S. Capability Forge & Sandbox (Ada-SI).
Tests AST Security Auditor, Linux bwrap/venv Sandbox, Secret Purging, and Tool Execution.
"""

import sys
import os
import json
import asyncio
from pathlib import Path
import pytest

# Add project root to sys.path
sys.path.insert(0, os.getcwd())

from core_engine.tool_ast_auditor import tool_ast_auditor
from core_engine.forge_sandbox import forge_sandbox
from core_engine.actuator_dispatcher import actuator_dispatcher


def test_ast_auditor_valid_code():
    print("[1/5] Testing AST Security Auditor on valid code...")
    valid_code = """
def get_tool_schema():
    return {
        "name": "celsius_to_fahrenheit",
        "description": "Convert Celsius to Fahrenheit",
        "parameters": {
            "type": "object",
            "properties": {
                "celsius": {"type": "number", "description": "Temp in C"}
            },
            "required": ["celsius"]
        }
    }

def run(celsius: float):
    return (celsius * 9/5) + 32
"""
    res = tool_ast_auditor.audit_tool_code(valid_code)
    assert res["valid"] is True, f"Expected valid, got errors: {res['errors']}"
    assert res["has_schema"] is True
    assert res["has_run"] is True
    assert res["function_name"] == "celsius_to_fahrenheit"
    print("  ✓ Valid code passed AST audit.")


def test_ast_auditor_blocks_forbidden_constructs():
    print("[2/5] Testing AST Security Auditor on forbidden constructs...")
    bad_codes = [
        ("import ctypes", "Forbidden module import: 'ctypes'"),
        ("from ctypes import c_int", "Forbidden from-import module: 'ctypes'"),
        ("def get_tool_schema(): return {}\ndef run(): eval('1+1')", "Forbidden dynamic evaluation call: 'eval()'"),
        ("def get_tool_schema(): return {}\ndef run(): open('/etc/shadow').read()", "Access to sensitive path detected: '/etc/shadow'"),
    ]

    for code, expected_err in bad_codes:
        res = tool_ast_auditor.audit_tool_code(code)
        assert res["valid"] is False, f"Expected invalid for code: {code}"
        assert any(expected_err in e for e in res["errors"]), f"Expected error '{expected_err}' in {res['errors']}"
    print("  ✓ All forbidden constructs blocked by ULTRON AST Auditor.")


@pytest.mark.asyncio
async def test_sandbox_execution_and_secret_stripping():
    print("[3/5] Testing Sandbox Execution and Secret Stripping...")
    # Verify master secrets are NOT present in sandbox environment
    os.environ["GEMINI_API_KEY"] = "sk-fake-gemini-key-12345"
    os.environ["OPENAI_API_KEY"] = "sk-fake-openai-key-67890"

    sandbox_test_script = """
import os, json
env_keys = list(os.environ.keys())
has_gemini = "GEMINI_API_KEY" in os.environ
has_openai = "OPENAI_API_KEY" in os.environ
print(json.dumps({"has_gemini": has_gemini, "has_openai": has_openai}))
"""
    res = await forge_sandbox.run_in_sandbox(sandbox_test_script)
    assert res["success"] is True, f"Sandbox failed: {res['stderr']}"
    parsed = json.loads(res["stdout"])
    assert parsed["has_gemini"] is False, "GEMINI_API_KEY leaked into sandbox!"
    assert parsed["has_openai"] is False, "OPENAI_API_KEY leaked into sandbox!"
    print("  ✓ Sandbox is sterile and secret-shielded.")


@pytest.mark.asyncio
async def test_end_to_end_tool_forge_and_dispatch():
    print("[4/5] Testing End-to-End Tool Forge and Dispatch...")
    tool_name = "math_square_cube"
    tool_code = """
def get_tool_schema():
    return {
        "name": "math_square_cube",
        "description": "Calculates square and cube of a number",
        "parameters": {
            "type": "object",
            "properties": {
                "n": {"type": "number", "description": "Input number"}
            },
            "required": ["n"]
        }
    }

def run(n: float):
    return {"square": n ** 2, "cube": n ** 3}
"""
    test_code = """
from math_square_cube import run
res = run(4)
assert res["square"] == 16
assert res["cube"] == 64
"""

    # 1. Forge tool via actuator dispatcher
    forge_res = await actuator_dispatcher.dispatch_tool("forge_custom_tool", {
        "name": tool_name,
        "description": "Computes square and cube",
        "code": tool_code,
        "test_code": test_code,
        "requirements": [],
    })
    assert forge_res["success"] is True, f"Forge failed: {forge_res}"
    print(f"  ✓ Tool '{tool_name}' forged and hot-reloaded.")

    # 2. Execute newly forged tool directly by name
    exec_res = await actuator_dispatcher.dispatch_tool(tool_name, {"n": 5})
    assert exec_res["success"] is True, f"Execution failed: {exec_res}"
    assert exec_res["result"]["square"] == 25
    assert exec_res["result"]["cube"] == 125
    print(f"  ✓ Executed '{tool_name}' directly via dispatcher. Result: {exec_res['result']}")

    # 3. Clean up tool
    del_res = await actuator_dispatcher.dispatch_tool("delete_custom_tool", {"tool_name": tool_name})
    assert del_res["success"] is True
    print(f"  ✓ Tool '{tool_name}' deleted and uninstalled cleanly.")


@pytest.mark.asyncio
async def test_list_custom_tools():
    print("[5/5] Testing Custom Tools Listing...")
    res = await actuator_dispatcher.dispatch_tool("list_custom_tools", {})
    assert res["success"] is True
    print(f"  ✓ List custom tools returned {res['count']} tools.")


async def main():
    print("=" * 60)
    print("J.A.R.V.I.S. Capability Forge (Ada-SI) Verification Suite")
    print("=" * 60)
    test_ast_auditor_valid_code()
    test_ast_auditor_blocks_forbidden_constructs()
    await test_sandbox_execution_and_secret_stripping()
    await test_end_to_end_tool_forge_and_dispatch()
    await test_list_custom_tools()
    print("=" * 60)
    print("ALL 5 CAPABILITY FORGE TESTS PASSED NOMINALLY (100% HEALTH)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
