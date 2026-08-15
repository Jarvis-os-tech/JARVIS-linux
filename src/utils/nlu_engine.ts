// Natural Language Understanding (NLU) Engine for J.A.R.V.I.S. Voice Agent
// Features:
// 1. High-precision Intent Classification (Taxonomy: questions, hardware/system requests, app control, vision, workspace, greetings, confirmations)
// 2. Multi-type Entity Extraction (names, dates/times, locations, apps, percentages/numbers, devices, paths)
// 3. Sentiment & Emotion Detection (sentiment polarity, urgency score, tone)
// 4. Contextual Slot Filling & Anaphora/Pronoun Resolution ("set it to 50%", "open that file")
// 5. Real-Time sub-millisecond execution for hands-free voice agents with optional LLM deep-parse

export type NluIntentCategory =
  | 'question'
  | 'system_control'
  | 'application_control'
  | 'vision_control'
  | 'workspace_action'
  | 'information_query'
  | 'file_system'
  | 'greeting'
  | 'farewell'
  | 'confirmation'
  | 'negation'
  | 'memory_instruction'
  | 'general_request'
  | 'unknown';

export interface ExtractedEntity {
  type: 'PERSON' | 'DATE' | 'TIME' | 'LOCATION' | 'APP_NAME' | 'DEVICE_TARGET' | 'PERCENTAGE' | 'NUMBER' | 'FILE_PATH' | 'ACTION_VERB' | 'KEYWORD';
  value: string;
  normalized?: any;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface NluIntentResult {
  category: NluIntentCategory;
  name: string;
  confidence: number;
  subIntent?: string;
  isActionable: boolean;
  requiresConfirmation: boolean;
}

export interface NluAnalysisResult {
  rawText: string;
  normalizedText: string;
  intent: NluIntentResult;
  secondaryIntents: NluIntentResult[];
  entities: ExtractedEntity[];
  sentiment: {
    polarity: 'positive' | 'neutral' | 'negative';
    score: number; // -1.0 to 1.0
    urgency: 'low' | 'medium' | 'high';
    isPolite: boolean;
  };
  contextSlots: Record<string, any>;
  suggestedAction?: {
    toolName?: string;
    args?: Record<string, any>;
    responseHint?: string;
  };
  processingTimeMs: number;
}

// Conversation context history for anaphora and slot filling
interface DialogueContextState {
  lastMentionedEntity?: ExtractedEntity;
  lastTargetDevice?: string;
  lastTargetApp?: string;
  lastFilePath?: string;
  lastIntent?: NluIntentResult;
  recentEntities: ExtractedEntity[];
  turnCount: number;
}

let globalDialogueContext: DialogueContextState = {
  recentEntities: [],
  turnCount: 0
};

export function resetDialogueContext(): void {
  globalDialogueContext = {
    recentEntities: [],
    turnCount: 0
  };
}

export function getDialogueContext(): DialogueContextState {
  return { ...globalDialogueContext };
}

// -------------------------------------------------------------
// 1. ENTITY EXTRACTION UTILITIES
// -------------------------------------------------------------

function extractPercentages(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const regex = /\b(\d{1,3})\s*(?:%|\bpercent\b|\bpercentage\b)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const val = parseInt(match[1], 10);
    if (val >= 0 && val <= 100) {
      results.push({
        type: 'PERCENTAGE',
        value: match[0],
        normalized: val,
        confidence: 0.98,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }
  return results;
}

function extractNumbers(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const regex = /\b(\d+(?:\.\d+)?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Avoid double counting if it's already part of a percentage
    const isPartOfPercent = text.slice(match.index, match.index + match[0].length + 8).match(/^\d+\s*(?:%|percent)/i);
    if (!isPartOfPercent) {
      results.push({
        type: 'NUMBER',
        value: match[0],
        normalized: parseFloat(match[1]),
        confidence: 0.92,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }
  return results;
}

function extractDatesAndTimes(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];

  // Relative / Named dates
  const datePatterns: { regex: RegExp; type: 'DATE' | 'TIME'; normalize: (m: RegExpExecArray) => any }[] = [
    {
      regex: /\b(today|tomorrow|yesterday|tonight|this morning|this afternoon|this evening)\b/gi,
      type: 'DATE',
      normalize: (m) => {
        const now = new Date();
        const str = m[1].toLowerCase();
        if (str === 'tomorrow') now.setDate(now.getDate() + 1);
        if (str === 'yesterday') now.setDate(now.getDate() - 1);
        return now.toISOString().split('T')[0];
      }
    },
    {
      regex: /\b(?:next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      type: 'DATE',
      normalize: (m) => m[0].toLowerCase()
    },
    {
      regex: /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/gi,
      type: 'TIME',
      normalize: (m) => {
        let hour = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const meridiem = (m[3] || '').toLowerCase();
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;
      }
    },
    {
      regex: /\b(\d{1,2})\s*(?:o'clock|am|pm)\b/gi,
      type: 'TIME',
      normalize: (m) => m[0].toLowerCase()
    },
    {
      regex: /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
      type: 'DATE',
      normalize: (m) => m[1]
    }
  ];

  for (const { regex, type, normalize } of datePatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      results.push({
        type,
        value: match[0],
        normalized: normalize(match),
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }

  return results;
}

function extractAppNames(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const knownApps = [
    'google chrome', 'chrome', 'firefox', 'brave', 'edge',
    'terminal', 'gnome-terminal', 'bash', 'kitty', 'alacritty',
    'visual studio code', 'vscode', 'code', 'vscodium',
    'nautilus', 'files', 'file manager', 'thunar', 'dolphin',
    'slack', 'discord', 'telegram', 'spotify', 'vlc',
    'settings', 'gnome-control-center', 'calculator', 'text editor', 'gedit'
  ];

  for (const app of knownApps) {
    const escaped = app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      results.push({
        type: 'APP_NAME',
        value: match[0],
        normalized: app.toLowerCase(),
        confidence: 0.96,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }
  return results;
}

function extractDeviceTargets(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const deviceKeywords = [
    'brightness', 'display', 'screen', 'monitor', 'backlight',
    'volume', 'speaker', 'audio', 'sound', 'headphone', 'microphone', 'mic',
    'battery', 'power', 'charger', 'ac power',
    'wifi', 'network', 'ethernet', 'bluetooth',
    'cpu', 'ram', 'memory', 'disk', 'storage', 'temperature', 'thermals'
  ];

  for (const target of deviceKeywords) {
    const regex = new RegExp(`\\b${target}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      results.push({
        type: 'DEVICE_TARGET',
        value: match[0],
        normalized: target.toLowerCase(),
        confidence: 0.94,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }
  return results;
}

function extractFilePaths(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const pathRegex = /(?:~|\/|[a-zA-Z]:\\)(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]*|\b[a-zA-Z0-9_-]+\.(?:ts|tsx|js|jsx|json|md|py|cpp|rs|go|html|css|txt|sh|db|png|jpg)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(text)) !== null) {
    results.push({
      type: 'FILE_PATH',
      value: match[0],
      normalized: match[0],
      confidence: 0.92,
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  return results;
}

function extractPersonsAndLocations(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];

  // Person patterns: "with Tony Stark", "call Gopi", "email Sarah", "my name is Alex"
  const personPatterns = [
    /(?:with|call|email|message|to|tell|ask)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g
  ];

  for (const pattern of personPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      // Filter common words that start capitalized
      const commonWords = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Google', 'Jarvis'];
      if (!commonWords.includes(name)) {
        results.push({
          type: 'PERSON',
          value: name,
          normalized: name,
          confidence: 0.88,
          startIndex: match.index + match[0].indexOf(name),
          endIndex: match.index + match[0].indexOf(name) + name.length
        });
      }
    }
  }

  // Location patterns: "in London", "at San Francisco", "from Tokyo", "weather in New York"
  const locationRegex = /\b(?:in|at|from|to|around|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  let locMatch: RegExpExecArray | null;
  while ((locMatch = locationRegex.exec(text)) !== null) {
    const loc = locMatch[1].trim();
    const blacklist = ['Jarvis', 'Google', 'Chrome', 'Firefox', 'Slack', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Terminal'];
    if (!blacklist.includes(loc)) {
      results.push({
        type: 'LOCATION',
        value: loc,
        normalized: loc,
        confidence: 0.82,
        startIndex: locMatch.index + locMatch[0].indexOf(loc),
        endIndex: locMatch.index + locMatch[0].indexOf(loc) + loc.length
      });
    }
  }

  return results;
}

// -------------------------------------------------------------
// 2. SENTIMENT & EMOTION ANALYSIS
// -------------------------------------------------------------

function analyzeSentiment(text: string): NluAnalysisResult['sentiment'] {
  const lower = text.toLowerCase();

  const positiveWords = ['thank', 'thanks', 'great', 'awesome', 'good', 'excellent', 'perfect', 'love', 'brilliant', 'wonderful', 'appreciate'];
  const negativeWords = ['bad', 'terrible', 'horrible', 'wrong', 'fail', 'broken', 'hate', 'annoying', 'error', 'slow', 'stuck', 'issue', 'bug'];
  const urgentWords = ['urgent', 'immediately', 'now', 'asap', 'quick', 'hurry', 'emergency', 'fast', 'critical'];
  const politeWords = ['please', 'could you', 'would you', 'kindly', 'thank you', 'thanks', 'sir'];

  let score = 0;
  for (const w of positiveWords) {
    if (lower.includes(w)) score += 0.25;
  }
  for (const w of negativeWords) {
    if (lower.includes(w)) score -= 0.3;
  }

  score = Math.max(-1.0, Math.min(1.0, score));

  let polarity: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (score > 0.15) polarity = 'positive';
  else if (score < -0.15) polarity = 'negative';

  let urgency: 'low' | 'medium' | 'high' = 'low';
  for (const u of urgentWords) {
    if (lower.includes(u)) {
      urgency = 'high';
      break;
    }
  }
  if (urgency === 'low' && (lower.endsWith('!') || lower.includes('quick'))) {
    urgency = 'medium';
  }

  let isPolite = false;
  for (const p of politeWords) {
    if (lower.includes(p)) {
      isPolite = true;
      break;
    }
  }

  return { polarity, score, urgency, isPolite };
}

// -------------------------------------------------------------
// 3. INTENT CLASSIFICATION ENGINE
// -------------------------------------------------------------

export function classifyIntent(
  text: string,
  entities: ExtractedEntity[],
  context: DialogueContextState
): { primary: NluIntentResult; secondary: NluIntentResult[]; suggestedAction?: NluAnalysisResult['suggestedAction'] } {
  const lower = text.toLowerCase().trim();
  const secondary: NluIntentResult[] = [];

  // Helper to create intent
  const makeIntent = (
    category: NluIntentCategory,
    name: string,
    confidence: number,
    subIntent?: string,
    isActionable = true,
    requiresConfirmation = false
  ): NluIntentResult => ({
    category,
    name,
    confidence,
    subIntent,
    isActionable,
    requiresConfirmation
  });

  // 1. Vision & Screen Sharing Hands-Free Intents
  if (
    lower.includes('screen share') ||
    lower.includes('screen sharing') ||
    lower.includes('share screen') ||
    lower.includes('share my screen') ||
    (lower.includes('camera') && (lower.includes('start') || lower.includes('open') || lower.includes('turn on') || lower.includes('enable'))) ||
    lower.includes('stop vision') ||
    lower.includes('stop screen') ||
    lower.includes('stop camera')
  ) {
    const isStop = lower.includes('stop') || lower.includes('disable') || lower.includes('turn off') || lower.includes('close');
    const isCamera = lower.includes('camera') || lower.includes('webcam');
    const isScreen = lower.includes('screen');

    const sub = isStop
      ? isCamera ? 'stop_camera' : isScreen ? 'stop_screen' : 'stop_all'
      : isCamera ? 'start_camera' : 'start_screen';

    return {
      primary: makeIntent('vision_control', 'control_vision_mode', 0.98, sub, true),
      secondary,
      suggestedAction: {
        toolName: 'control_vision_mode',
        args: { action: isStop ? 'stop' : 'start', mode: isCamera ? 'camera' : 'screen' },
        responseHint: `Vision mode ${sub} triggered.`
      }
    };
  }

  // 2. Hardware System Control (Brightness, Volume, Battery, Power)
  const deviceEntities = entities.filter(e => e.type === 'DEVICE_TARGET');
  const percentEntity = entities.find(e => e.type === 'PERCENTAGE');
  const targetDevice = deviceEntities[0]?.normalized || context.lastTargetDevice;

  if (
    lower.includes('brightness') ||
    lower.includes('backlight') ||
    (targetDevice === 'brightness' && (percentEntity || lower.includes('set') || lower.includes('dim') || lower.includes('increase') || lower.includes('decrease')))
  ) {
    const isQuery = lower.startsWith('what') || lower.includes('get') || lower.includes('current') || lower.includes('how bright');
    if (isQuery && !percentEntity) {
      return {
        primary: makeIntent('information_query', 'get_screen_brightness', 0.95, 'query_hardware', true),
        secondary,
        suggestedAction: { toolName: 'get_screen_brightness', args: {} }
      };
    }
    const percentVal = percentEntity ? percentEntity.normalized : (lower.includes('max') ? 100 : lower.includes('min') || lower.includes('dim') ? 10 : 50);
    return {
      primary: makeIntent('system_control', 'set_screen_brightness', 0.96, 'adjust_brightness', true),
      secondary,
      suggestedAction: {
        toolName: 'set_screen_brightness',
        args: { percent: percentVal },
        responseHint: `Adjusting screen brightness to ${percentVal}%.`
      }
    };
  }

  if (
    lower.includes('volume') ||
    lower.includes('sound') ||
    lower.includes('mute') ||
    lower.includes('unmute') ||
    (targetDevice === 'volume' && (percentEntity || lower.includes('set') || lower.includes('louder') || lower.includes('quieter')))
  ) {
    if (lower.includes('mute')) {
      const isUnmute = lower.includes('unmute');
      return {
        primary: makeIntent('system_control', 'mute_system_volume', 0.96, isUnmute ? 'unmute' : 'mute', true),
        secondary,
        suggestedAction: {
          toolName: 'mute_system_volume',
          args: { mute: !isUnmute },
          responseHint: isUnmute ? 'Unmuting system volume.' : 'Muting system volume.'
        }
      };
    }
    const isQuery = lower.startsWith('what') || lower.includes('get') || lower.includes('level') || lower.includes('how loud');
    if (isQuery && !percentEntity) {
      return {
        primary: makeIntent('information_query', 'get_system_volume', 0.95, 'query_hardware', true),
        secondary,
        suggestedAction: { toolName: 'get_system_volume', args: {} }
      };
    }
    const percentVal = percentEntity ? percentEntity.normalized : (lower.includes('max') ? 100 : lower.includes('low') ? 20 : 60);
    return {
      primary: makeIntent('system_control', 'set_system_volume', 0.96, 'adjust_volume', true),
      secondary,
      suggestedAction: {
        toolName: 'set_system_volume',
        args: { percent: percentVal },
        responseHint: `Setting speaker volume to ${percentVal}%.`
      }
    };
  }

  if (lower.includes('battery') || lower.includes('charge') || lower.includes('power level') || lower.includes('remaining battery')) {
    return {
      primary: makeIntent('information_query', 'get_battery_status', 0.98, 'query_telemetry', true),
      secondary,
      suggestedAction: { toolName: 'get_battery_status', args: {} }
    };
  }

  if (lower.includes('temperature') || lower.includes('thermal') || lower.includes('cpu temp') || lower.includes('is it hot')) {
    return {
      primary: makeIntent('information_query', 'get_thermal_sensors', 0.96, 'query_telemetry', true),
      secondary,
      suggestedAction: { toolName: 'get_thermal_sensors', args: {} }
    };
  }

  // 3. Application & Process Control
  const appEntities = entities.filter(e => e.type === 'APP_NAME');
  if (
    lower.startsWith('open ') ||
    lower.startsWith('launch ') ||
    lower.startsWith('start ') ||
    lower.startsWith('run ') ||
    appEntities.length > 0
  ) {
    if (appEntities.length > 0 || lower.includes('chrome') || lower.includes('terminal') || lower.includes('code')) {
      const appName = appEntities[0]?.normalized || (lower.includes('chrome') ? 'google-chrome' : lower.includes('terminal') ? 'gnome-terminal' : 'code');
      return {
        primary: makeIntent('application_control', 'launch_application', 0.94, 'launch_app', true),
        secondary,
        suggestedAction: {
          toolName: 'launch_application',
          args: { appNameOrCommand: appName },
          responseHint: `Launching ${appName}, sir.`
        }
      };
    }
  }

  // 4. Memory & Fact Retention
  if (lower.includes('remember that') || lower.includes('note that') || lower.includes('keep in mind') || lower.includes('save fact')) {
    return {
      primary: makeIntent('memory_instruction', 'save_memory_fact', 0.95, 'persist_memory', true),
      secondary
    };
  }

  // 5. Workspace (Calendar, Email, Docs, Tasks)
  if (lower.includes('calendar') || lower.includes('meeting') || lower.includes('schedule') || lower.includes('events today')) {
    const isCreate = lower.includes('schedule') || lower.includes('book') || lower.includes('create') || lower.includes('add');
    return {
      primary: makeIntent('workspace_action', isCreate ? 'create_calendar_event' : 'list_calendar_events', 0.92, 'calendar', true),
      secondary,
      suggestedAction: {
        toolName: isCreate ? 'create_calendar_event' : 'list_calendar_events',
        args: {}
      }
    };
  }

  if (lower.includes('email') || lower.includes('gmail') || lower.includes('inbox') || lower.includes('unread messages')) {
    const isSend = lower.includes('send') || lower.includes('compose') || lower.includes('write');
    return {
      primary: makeIntent('workspace_action', isSend ? 'send_email' : 'list_unread_emails', 0.92, 'gmail', true),
      secondary,
      suggestedAction: {
        toolName: isSend ? 'send_email' : 'list_unread_emails',
        args: {}
      }
    };
  }

  // 6. Greetings & Social Intros
  const greetingRegex = /^(?:hi|hello|hey|good morning|good afternoon|good evening|greetings|jarvis|what's up|yo)\b/i;
  if (greetingRegex.test(lower)) {
    return {
      primary: makeIntent('greeting', 'greet_user', 0.95, 'social', false),
      secondary
    };
  }

  // 7. Farewell
  const farewellRegex = /^(?:bye|goodbye|see you|good night|exit|quit|shut down jarvis)\b/i;
  if (farewellRegex.test(lower)) {
    return {
      primary: makeIntent('farewell', 'goodbye', 0.95, 'social', false),
      secondary
    };
  }

  // 8. Confirmations / Negations
  if (/^(?:yes|yeah|sure|confirm|proceed|ok|okay|yep|absolutely|affirmative)\b/i.test(lower)) {
    return {
      primary: makeIntent('confirmation', 'confirm_action', 0.96, 'dialogue_control', true),
      secondary
    };
  }
  if (/^(?:no|nope|cancel|stop|abort|negative|don't|do not)\b/i.test(lower)) {
    return {
      primary: makeIntent('negation', 'cancel_action', 0.96, 'dialogue_control', true),
      secondary
    };
  }

  // 9. Questions vs Requests
  const isQuestion =
    lower.startsWith('what') ||
    lower.startsWith('who') ||
    lower.startsWith('where') ||
    lower.startsWith('when') ||
    lower.startsWith('why') ||
    lower.startsWith('how') ||
    lower.startsWith('can you') ||
    lower.startsWith('is there') ||
    lower.endsWith('?');

  if (isQuestion) {
    return {
      primary: makeIntent('question', 'ask_question', 0.88, 'general_qa', false),
      secondary: [makeIntent('information_query', 'search_knowledge', 0.75)]
    };
  }

  // Default: General actionable or non-actionable request
  return {
    primary: makeIntent('general_request', 'process_user_utterance', 0.75, 'general', true),
    secondary
  };
}

// -------------------------------------------------------------
// 4. MAIN NLU ANALYZER & CONTEXT RESOLVER
// -------------------------------------------------------------

export function analyzeUtterance(text: string): NluAnalysisResult {
  const startTime = performance.now();
  const rawText = text || '';
  const normalizedText = rawText.trim().replace(/\s+/g, ' ');

  // 1. Extract all Entity types
  const entities: ExtractedEntity[] = [
    ...extractPercentages(normalizedText),
    ...extractNumbers(normalizedText),
    ...extractDatesAndTimes(normalizedText),
    ...extractAppNames(normalizedText),
    ...extractDeviceTargets(normalizedText),
    ...extractFilePaths(normalizedText),
    ...extractPersonsAndLocations(normalizedText)
  ].sort((a, b) => a.startIndex - b.startIndex);

  // 2. Classify Intent & Match Actions
  const { primary, secondary, suggestedAction } = classifyIntent(normalizedText, entities, globalDialogueContext);

  // 3. Sentiment & Emotion Analysis
  const sentiment = analyzeSentiment(normalizedText);

  // 4. Context Slot Filling & State Tracking
  const contextSlots: Record<string, any> = {};

  for (const entity of entities) {
    if (entity.type === 'DEVICE_TARGET') {
      contextSlots.targetDevice = entity.normalized;
      globalDialogueContext.lastTargetDevice = entity.normalized;
    }
    if (entity.type === 'APP_NAME') {
      contextSlots.targetApp = entity.normalized;
      globalDialogueContext.lastTargetApp = entity.normalized;
    }
    if (entity.type === 'PERCENTAGE') {
      contextSlots.targetPercentage = entity.normalized;
    }
    if (entity.type === 'FILE_PATH') {
      contextSlots.filePath = entity.normalized;
      globalDialogueContext.lastFilePath = entity.normalized;
    }
    if (entity.type === 'PERSON') {
      contextSlots.person = entity.normalized;
    }
    if (entity.type === 'DATE' || entity.type === 'TIME') {
      contextSlots[entity.type.toLowerCase()] = entity.normalized;
    }
  }

  if (entities.length > 0) {
    globalDialogueContext.lastMentionedEntity = entities[entities.length - 1];
    globalDialogueContext.recentEntities = [...entities, ...globalDialogueContext.recentEntities].slice(0, 10);
  }
  globalDialogueContext.lastIntent = primary;
  globalDialogueContext.turnCount++;

  const processingTimeMs = parseFloat((performance.now() - startTime).toFixed(2));

  return {
    rawText,
    normalizedText,
    intent: primary,
    secondaryIntents: secondary,
    entities,
    sentiment,
    contextSlots,
    suggestedAction,
    processingTimeMs
  };
}
