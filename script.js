/* ============================================================
   STEP 1 - Get the HTML elements we need
   ============================================================ */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const currentQuestion = document.getElementById("currentQuestion");
const quickPrompts = document.getElementById("quickPrompts");
const categoryFilters = document.getElementById("categoryFilters");
const presetGoals = document.getElementById("presetGoals");
const testApiBtn = document.getElementById("testApiBtn");
const apiStatus = document.getElementById("apiStatus");

/* ============================================================
  STEP 2 - API endpoint settings
  By default, the app sends requests to the deployed Worker API URL.
  You can still override this in secrets.js with CHAT_API_URL if needed.
  ============================================================ */
const DEFAULT_API_PATH =
  "https://loreal-chatbot-api.jackie-valiente1.workers.dev";

// Supports config from either `const CHAT_API_URL` or `window.CHAT_API_URL`.
// If someone provides only a domain (without path), we add /api/chat.
function normalizeApiUrl(rawUrl) {
  const trimmedUrl = rawUrl ? rawUrl.trim() : "";

  if (!trimmedUrl) {
    return DEFAULT_API_PATH;
  }

  if (trimmedUrl.startsWith("/")) {
    return trimmedUrl;
  }

  if (/^https?:\/\/[^/]+$/i.test(trimmedUrl)) {
    return `${trimmedUrl}/api/chat`;
  }

  return trimmedUrl;
}

const configuredApiUrl =
  (typeof CHAT_API_URL !== "undefined" && CHAT_API_URL) ||
  (typeof window !== "undefined" && typeof window.CHAT_API_URL === "string"
    ? window.CHAT_API_URL
    : "");

const API_URL = normalizeApiUrl(configuredApiUrl);
const IS_SAME_SITE_API = API_URL.startsWith("/");
const OFF_TOPIC_REPLY =
  "I'm only able to help with L'Oreal beauty topics. Ask me about makeup, skincare, haircare, fragrance, or a personalized routine.";

// Builds a small list of URL candidates so we can recover from path mismatch.
function getApiCandidates(primaryUrl) {
  const candidates = [primaryUrl];

  if (primaryUrl.startsWith("http://") || primaryUrl.startsWith("https://")) {
    if (primaryUrl.endsWith("/api/chat")) {
      candidates.push(primaryUrl.replace(/\/api\/chat$/, ""));
    } else if (/^https?:\/\/[^/]+$/i.test(primaryUrl)) {
      candidates.push(`${primaryUrl}/api/chat`);
    }
  }

  return [...new Set(candidates)];
}

// Tries the configured URL first, then one fallback URL if we get a 404.
async function fetchWithApiFallback(requestOptions) {
  const urlsToTry = getApiCandidates(API_URL);
  let lastResponse = null;

  for (let index = 0; index < urlsToTry.length; index += 1) {
    const url = urlsToTry[index];
    const response = await fetch(url, requestOptions);

    if (response.status !== 404 || index === urlsToTry.length - 1) {
      return { response, usedUrl: url };
    }

    lastResponse = response;
  }

  return { response: lastResponse, usedUrl: API_URL };
}

/* ============================================================
  STEP 2B - Active category filter
  Used to guide quick prompts and add context to user messages.
  ============================================================ */
let activeCategory = "all";
let activeGoal = "";

/* ============================================================
   STEP 3 - User profile details for personalization
   We fill this as the user shares details in the conversation.
   ============================================================ */
const userProfile = {
  name: "",
  skinType: "",
  skinConcern: "",
  hairType: "",
  hairConcern: "",
  fragranceStyle: "",
  budget: "",
};

// Keeps a short memory of the conversation for better multi-turn replies.
const conversationContext = {
  recentQuestions: [],
  maxRecentQuestions: 8,
};

// Saves key chat context so it survives a browser refresh.
const LOCAL_STORAGE_KEY = "loreal-chatbot-memory-v1";
const MAX_SAVED_MESSAGES = 20;

function getBrowserStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function saveConversationState() {
  const storage = getBrowserStorage();
  if (!storage) return;

  const messagesToSave = messages
    .filter((message) => message.role !== "system")
    .slice(-MAX_SAVED_MESSAGES);

  const payload = {
    userProfile,
    recentQuestions: conversationContext.recentQuestions,
    messages: messagesToSave,
  };

  try {
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not save chatbot memory:", error);
  }
}

function loadConversationState() {
  const storage = getBrowserStorage();
  if (!storage) return false;

  try {
    const raw = storage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;

    if (parsed.userProfile && typeof parsed.userProfile === "object") {
      Object.keys(userProfile).forEach((key) => {
        const value = parsed.userProfile[key];
        userProfile[key] = typeof value === "string" ? value : "";
      });
    }

    if (Array.isArray(parsed.recentQuestions)) {
      conversationContext.recentQuestions = parsed.recentQuestions
        .filter((item) => typeof item === "string" && item.trim())
        .slice(0, conversationContext.maxRecentQuestions);
    }

    if (Array.isArray(parsed.messages)) {
      const validMessages = parsed.messages
        .filter(
          (message) =>
            message &&
            typeof message === "object" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string",
        )
        .slice(-MAX_SAVED_MESSAGES);

      if (validMessages.length > 0) {
        messages.push(...validMessages);
      }
    }

    return true;
  } catch (error) {
    console.warn("Could not load chatbot memory:", error);
    return false;
  }
}

function cleanStoredUserText(text) {
  return text.replace(/^\[Category focus:[^\]]+\]\s*/i, "");
}

function restoreChatWindowFromMemory() {
  const restoredMessages = messages.filter(
    (message) => message.role !== "system",
  );

  restoredMessages.forEach((message) => {
    const textToShow =
      message.role === "user"
        ? cleanStoredUserText(message.content)
        : message.content;

    displayMessage(message.role, textToShow);
  });

  if (conversationContext.recentQuestions.length > 0) {
    currentQuestion.textContent = buildCurrentQuestionText(
      conversationContext.recentQuestions[0],
    );
  }
}

/* ============================================================
   STEP 4 - Build the system prompt dynamically
   We inject known user details so recommendations feel personal.
   ============================================================ */
function buildSystemPrompt() {
  let knownDetails = "";

  if (userProfile.name) knownDetails += `\n- Name: ${userProfile.name}`;
  if (userProfile.skinType)
    knownDetails += `\n- Skin type: ${userProfile.skinType}`;
  if (userProfile.skinConcern)
    knownDetails += `\n- Skin concern: ${userProfile.skinConcern}`;
  if (userProfile.hairType)
    knownDetails += `\n- Hair type: ${userProfile.hairType}`;
  if (userProfile.hairConcern)
    knownDetails += `\n- Hair concern: ${userProfile.hairConcern}`;
  if (userProfile.fragranceStyle)
    knownDetails += `\n- Fragrance style: ${userProfile.fragranceStyle}`;
  if (userProfile.budget) knownDetails += `\n- Budget: ${userProfile.budget}`;

  let recentQuestionContext = "";
  if (conversationContext.recentQuestions.length > 0) {
    recentQuestionContext = `\nRecent user questions (most recent first):\n- ${conversationContext.recentQuestions.join("\n- ")}`;
  }

  return `You are L'Oreal Beauty Advisor.

Only help with L'Oreal beauty topics:
- L'Oreal products and brands
- Skincare, makeup, haircare, fragrance routines
- Personalized recommendations

Rules:
- If a question is unrelated to L'Oreal beauty topics, reply exactly:
"${OFF_TOPIC_REPLY}"
- If asked about competitor brands, do not provide competitor advice. Politely redirect to the closest L'Oreal options.
- Do not provide medical diagnosis or treatment claims.

Style:
- Keep responses concise and practical.
- If the user's name is unknown, ask for their name early in the conversation.
- Ask one clarifying question if key details are missing.
- For routines, use numbered steps.
- For recommendations, suggest 2 to 4 products with short reasons.

  Known user details:${knownDetails || "\n- No details yet."}
${recentQuestionContext}`;
}

function addQuestionToContext(questionText) {
  conversationContext.recentQuestions.unshift(questionText);

  if (
    conversationContext.recentQuestions.length >
    conversationContext.maxRecentQuestions
  ) {
    conversationContext.recentQuestions =
      conversationContext.recentQuestions.slice(
        0,
        conversationContext.maxRecentQuestions,
      );
  }
}

/* ============================================================
   STEP 5 - Conversation history (messages)
   messages[0] is the system prompt and gets refreshed each turn.
   ============================================================ */
const messages = [{ role: "system", content: buildSystemPrompt() }];

/* ============================================================
   STEP 5B - Category labels and prompt suggestions
   ============================================================ */
const categoryLabels = {
  all: "All",
  makeup: "Makeup",
  skincare: "Skincare",
  haircare: "Haircare",
  fragrance: "Fragrance",
};

const promptsByCategory = {
  all: [
    "Build me a morning skincare routine",
    "Recommend makeup for oily skin",
    "I need a frizz-control haircare routine",
    "Suggest a fresh everyday fragrance",
    "Help me pick products for dark spots",
  ],
  makeup: [
    "Recommend a natural everyday makeup routine",
    "Help me choose a foundation for combination skin",
    "Suggest long-lasting lipstick shades for work",
    "Build a beginner makeup kit from L'Oreal brands",
  ],
  skincare: [
    "Build me a simple morning skincare routine",
    "Suggest products for dark spots and dullness",
    "Recommend a routine for sensitive skin",
    "What should I use for acne-prone skin?",
  ],
  haircare: [
    "I need a full routine for frizzy hair",
    "Recommend products for damaged hair",
    "Suggest a routine for thinning hair",
    "How can I care for color-treated hair?",
  ],
  fragrance: [
    "Suggest a fresh daytime fragrance",
    "Recommend a warm evening fragrance",
    "Help me choose a floral perfume",
    "Find me a long-lasting signature scent",
  ],
};

const goalsByCategory = {
  all: [
    {
      label: "Beginner routine",
      prompt: "Build me a simple beginner beauty routine for every day.",
    },
    {
      label: "Budget picks",
      prompt: "Recommend budget-friendly L'Oreal products across categories.",
    },
    {
      label: "Occasion ready",
      prompt: "Create a beauty plan for a special event this weekend.",
    },
  ],
  makeup: [
    {
      label: "Long-wear look",
      prompt: "Build a long-lasting makeup routine that stays fresh all day.",
    },
    {
      label: "Natural finish",
      prompt: "Recommend products for a natural no-makeup makeup look.",
    },
    {
      label: "Glow boost",
      prompt: "Help me create a glowy makeup look using L'Oreal brands.",
    },
  ],
  skincare: [
    {
      label: "Hydration",
      prompt: "Build me a hydration-focused skincare routine.",
    },
    {
      label: "Dark spots",
      prompt: "Recommend a skincare routine focused on dark spots.",
    },
    {
      label: "Calming care",
      prompt: "Suggest a gentle routine for sensitive and reactive skin.",
    },
  ],
  haircare: [
    {
      label: "Anti-frizz",
      prompt: "Build an anti-frizz haircare routine I can follow weekly.",
    },
    {
      label: "Repair damage",
      prompt: "Recommend a repair routine for dry and damaged hair.",
    },
    {
      label: "Volume",
      prompt: "Suggest products for fuller looking hair with volume.",
    },
  ],
  fragrance: [
    {
      label: "Office scent",
      prompt: "Suggest subtle fragrances that work well for office wear.",
    },
    {
      label: "Date night",
      prompt: "Recommend an elegant fragrance for evening and date nights.",
    },
    {
      label: "Signature scent",
      prompt: "Help me choose a long-lasting signature fragrance.",
    },
  ],
};

/* ============================================================
   STEP 6 - Extract user profile details from plain text
   Simple pattern matching keeps this easy for beginners.
   ============================================================ */
function extractProfile(messageText) {
  const lower = messageText.toLowerCase();

  const nameMatch = messageText.match(
    /(?:my name is|i am|i'm|call me)\s+([A-Za-z]{2,})/i,
  );
  if (nameMatch) {
    userProfile.name =
      nameMatch[1].charAt(0).toUpperCase() +
      nameMatch[1].slice(1).toLowerCase();
  }

  if (/\boily\b/.test(lower)) userProfile.skinType = "oily";
  if (/\bdry\b/.test(lower)) userProfile.skinType = "dry";
  if (/\bcombination\b/.test(lower)) userProfile.skinType = "combination";
  if (/\bsensitive\b/.test(lower)) userProfile.skinType = "sensitive";

  if (/\bacne\b|\bbreakout/.test(lower)) userProfile.skinConcern = "acne-prone";
  if (/\bdark spots\b|\bpigment/.test(lower))
    userProfile.skinConcern = "dark spots";
  if (/\bdull\b/.test(lower)) userProfile.skinConcern = "dullness";
  if (/\banti[- ]?age\b|\bwrinkle/.test(lower))
    userProfile.skinConcern = "fine lines";

  if (/\bcurly\b/.test(lower)) userProfile.hairType = "curly";
  if (/\bwavy\b/.test(lower)) userProfile.hairType = "wavy";
  if (/\bstraight\b/.test(lower)) userProfile.hairType = "straight";
  if (/\bcoily\b/.test(lower)) userProfile.hairType = "coily";

  if (/\bfrizz\b/.test(lower)) userProfile.hairConcern = "frizz";
  if (/\bdamage\b|\bbreakage\b/.test(lower)) userProfile.hairConcern = "damage";
  if (/\bthin\b|\bhair loss\b/.test(lower))
    userProfile.hairConcern = "thinning";
  if (/\bdandruff\b/.test(lower)) userProfile.hairConcern = "dandruff";

  if (/\bfresh\b|\bcitrus\b/.test(lower))
    userProfile.fragranceStyle = "fresh/citrus";
  if (/\bfloral\b/.test(lower)) userProfile.fragranceStyle = "floral";
  if (/\bwoody\b/.test(lower)) userProfile.fragranceStyle = "woody";
  if (/\bvanilla\b|\bgourmand\b/.test(lower))
    userProfile.fragranceStyle = "warm/gourmand";

  if (/\bbudget\b|\baffordable\b|\bunder\s+\$?\d+/.test(lower)) {
    userProfile.budget = "budget-friendly";
  }
  if (/\bluxury\b|\bpremium\b/.test(lower)) {
    userProfile.budget = "premium";
  }
}

function tryCaptureSimpleName(messageText) {
  const cleanedText = messageText.trim().replace(/[.,!?]/g, "");
  const singleWordName = cleanedText.match(/^[A-Za-z]{2,20}$/);

  if (!singleWordName) {
    return "";
  }

  return (
    singleWordName[0].charAt(0).toUpperCase() +
    singleWordName[0].slice(1).toLowerCase()
  );
}

/* ============================================================
   STEP 7 - Safe text rendering helper
   This prevents HTML injection in chat bubbles.
   ============================================================ */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================
   STEP 7B - Build assistant label with active context
   ============================================================ */
function buildAssistantLabel() {
  const labelParts = ["L'Oreal Beauty Advisor"];

  if (activeCategory !== "all") {
    labelParts.push(categoryLabels[activeCategory]);
  }

  if (activeGoal) {
    labelParts.push(activeGoal);
  }

  return labelParts.join(" | ");
}

function buildThinkingPhrase() {
  if (userProfile.name) {
    return `Because you're worth it, ${userProfile.name}...`;
  }

  return "Because you're worth it...";
}

/* ============================================================
   STEP 8 - Add a chat message bubble
   ============================================================ */
function displayMessage(role, text) {
  const isUser = role === "user";

  const row = document.createElement("div");
  row.classList.add("msg-row", isUser ? "user" : "ai");

  if (!isUser) {
    const avatar = document.createElement("div");
    avatar.classList.add("msg-avatar");
    avatar.textContent = "L";
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.classList.add("bubble", isUser ? "user" : "ai");

  const senderLabel = isUser
    ? userProfile.name || "You"
    : buildAssistantLabel();

  const safeText = escapeHtml(text).replace(/\n/g, "<br>");
  bubble.innerHTML = `<span class="msg-label">${senderLabel}</span>${safeText}`;

  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* ============================================================
   STEP 9 - Typing indicator helpers
   ============================================================ */
function showThinking() {
  const row = document.createElement("div");
  row.classList.add("msg-row", "ai");

  const avatar = document.createElement("div");
  avatar.classList.add("msg-avatar");
  avatar.textContent = "L";

  const bubble = document.createElement("div");
  bubble.classList.add("bubble", "ai", "thinking");
  bubble.innerHTML = `<span class="msg-label">${buildAssistantLabel()}</span>${buildThinkingPhrase()}`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return row;
}

/* ============================================================
   STEP 9B - API connection test helper
   Lets users verify API setup before sending chat messages.
   ============================================================ */
function setApiStatus(message, statusType) {
  if (!apiStatus) return;

  apiStatus.textContent = message;
  apiStatus.classList.remove("success", "error");

  if (statusType === "success") {
    apiStatus.classList.add("success");
  }

  if (statusType === "error") {
    apiStatus.classList.add("error");
  }
}

async function testApiConnection() {
  if (!testApiBtn) return;

  testApiBtn.disabled = true;
  setApiStatus("Checking API connection...", "");

  try {
    const { response, usedUrl } = await fetchWithApiFallback({
      method: "GET",
    });

    if (response.status === 404) {
      throw new Error(
        `Endpoint not found at ${usedUrl}. Deploy /api/chat on Cloudflare Pages (functions/api/chat.js) or point CHAT_API_URL to a working API endpoint.`,
      );
    }

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      throw new Error(
        `Received HTML from ${usedUrl}. This URL is likely your website, not the chat API endpoint.`,
      );
    }

    let data = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Expected JSON but got a different response (status ${response.status}).`,
        );
      }
    }

    const endpointWorked =
      response.status === 405 ||
      response.ok ||
      typeof data?.error === "string" ||
      typeof data?.error?.message === "string";

    if (!endpointWorked) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

    setApiStatus(
      `API reachable at ${usedUrl} (status ${response.status}).`,
      "success",
    );
  } catch (error) {
    const reason =
      error && error.message
        ? error.message
        : "Unknown error while testing API.";

    setApiStatus(`API check failed: ${reason}`, "error");
  }

  testApiBtn.disabled = false;
}

/* ============================================================
   STEP 10 - Quick prompt buttons to guide discovery
   ============================================================ */
function renderQuickPrompts() {
  if (!quickPrompts) return;

  quickPrompts.innerHTML = "";

  const suggestions =
    promptsByCategory[activeCategory] || promptsByCategory.all;

  suggestions.forEach((promptText) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prompt-chip";
    button.textContent = promptText;

    button.addEventListener("click", () => {
      userInput.value = promptText;
      handleUserMessage(promptText);
    });

    quickPrompts.appendChild(button);
  });
}

/* ============================================================
   STEP 10B - Render category filter buttons
   ============================================================ */
function renderCategoryFilters() {
  if (!categoryFilters) return;

  categoryFilters.innerHTML = "";

  Object.keys(categoryLabels).forEach((categoryKey) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      categoryKey === activeCategory ? "category-chip active" : "category-chip";
    button.textContent = categoryLabels[categoryKey];
    button.setAttribute("aria-pressed", String(categoryKey === activeCategory));

    button.addEventListener("click", () => {
      activeCategory = categoryKey;
      activeGoal = "";
      renderCategoryFilters();
      renderPresetGoals();
      renderQuickPrompts();
    });

    categoryFilters.appendChild(button);
  });
}

/* ============================================================
   STEP 10C - Render goal chips for the active category
   ============================================================ */
function renderPresetGoals() {
  if (!presetGoals) return;

  presetGoals.innerHTML = "";

  const goals = goalsByCategory[activeCategory] || goalsByCategory.all;

  goals.forEach((goalItem) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      activeGoal === goalItem.label ? "goal-chip active" : "goal-chip";
    button.textContent = goalItem.label;
    button.setAttribute("aria-pressed", String(activeGoal === goalItem.label));

    button.addEventListener("click", () => {
      activeGoal = goalItem.label;
      renderPresetGoals();
      userInput.value = goalItem.prompt;
      handleUserMessage(goalItem.prompt);
    });

    presetGoals.appendChild(button);
  });
}

/* ============================================================
   STEP 10D - Build banner text with active context
   ============================================================ */
function buildCurrentQuestionText(questionText) {
  return `Latest question: ${questionText}`;
}

/* ============================================================
   STEP 10E - Simple off-topic filter
   This keeps the chatbot focused on L'Oreal beauty topics.
   ============================================================ */
function isBeautyOrLorealTopic(text) {
  const lower = text.toLowerCase();

  // Keywords that indicate the user is asking about beauty/L'Oreal topics.
  const allowedKeywords = [
    "l'oreal",
    "loreal",
    "makeup",
    "skincare",
    "haircare",
    "fragrance",
    "beauty",
    "foundation",
    "serum",
    "cleanser",
    "moisturizer",
    "shampoo",
    "conditioner",
    "perfume",
    "lipstick",
    "mascara",
    "routine",
    "maybelline",
    "garnier",
    "nyx",
    "cerave",
    "la roche-posay",
    "vichy",
    "kerastase",
    "redken",
    "lancome",
    "ysl",
    "giorgio armani",
  ];

  return allowedKeywords.some((keyword) => lower.includes(keyword));
}

/* ============================================================
   STEP 11 - Main send message flow
   ============================================================ */
async function handleUserMessage(rawText) {
  const userText = rawText.trim();
  if (!userText) return;

  // Add explicit category context to guide model output.
  const userTextWithCategory =
    activeCategory === "all"
      ? userText
      : `[Category focus: ${categoryLabels[activeCategory]}] ${userText}`;

  if (userInput.value.trim() === userText) {
    userInput.value = "";
  }

  const hadNameBefore = Boolean(userProfile.name);
  extractProfile(userTextWithCategory);

  if (!userProfile.name) {
    const simpleName = tryCaptureSimpleName(userText);
    if (simpleName) {
      userProfile.name = simpleName;
    }
  }

  const capturedNameThisTurn = !hadNameBefore && Boolean(userProfile.name);

  addQuestionToContext(userText);
  currentQuestion.textContent = buildCurrentQuestionText(userText);

  displayMessage("user", userText);

  if (capturedNameThisTurn) {
    const nameWelcomeReply = `Bonjour ${userProfile.name}, I can help you discover L'Oreal makeup, skincare, haircare, and fragrances, and build a personalized routine.`;

    displayMessage("assistant", nameWelcomeReply);
    messages.push({ role: "user", content: userText });
    messages.push({ role: "assistant", content: nameWelcomeReply });
    messages[0].content = buildSystemPrompt();
    saveConversationState();
    return;
  }

  // Politely refuse clearly unrelated topics without calling the API.
  if (!isBeautyOrLorealTopic(userText)) {
    displayMessage("assistant", OFF_TOPIC_REPLY);
    messages.push({ role: "user", content: userText });
    messages.push({ role: "assistant", content: OFF_TOPIC_REPLY });
    saveConversationState();
    return;
  }

  messages.push({ role: "user", content: userTextWithCategory });
  messages[0].content = buildSystemPrompt();
  saveConversationState();

  userInput.disabled = true;
  sendBtn.disabled = true;

  const thinkingRow = showThinking();

  try {
    const { response } = await fetchWithApiFallback({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_completion_tokens: 350,
      }),
    });

    const responseText = await response.text();
    let data = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `API returned a non-JSON response (status ${response.status}).`,
        );
      }
    }

    if (!response.ok) {
      const apiMessage =
        data?.error?.message ||
        data?.error ||
        `Request failed with status ${response.status}`;
      throw new Error(apiMessage);
    }

    const aiReply = data.choices?.[0]?.message?.content;

    if (!aiReply) {
      throw new Error("The assistant response was empty.");
    }

    messages.push({ role: "assistant", content: aiReply });
    saveConversationState();

    thinkingRow.remove();
    displayMessage("assistant", aiReply);
  } catch (error) {
    thinkingRow.remove();

    const reason =
      error && error.message
        ? error.message
        : "Unknown error while contacting the API.";

    const setupHint = IS_SAME_SITE_API
      ? "This page is using the same-site /api/chat endpoint. If you are testing outside your deployed Cloudflare Pages site, set CHAT_API_URL in secrets.js to your deployed API URL."
      : `This page is using CHAT_API_URL: ${API_URL}`;

    displayMessage(
      "assistant",
      `I could not connect right now.\n\nReason: ${reason}\n\n${setupHint}`,
    );

    console.error("Chat request failed:", error);
  }

  userInput.disabled = false;
  sendBtn.disabled = false;
  userInput.focus();
}

/* ============================================================
   STEP 12 - Submit event from the input form
   ============================================================ */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleUserMessage(userInput.value);
});

if (testApiBtn) {
  testApiBtn.addEventListener("click", async () => {
    await testApiConnection();
  });
}

/* ============================================================
   STEP 13 - Welcome message on page load
   ============================================================ */
const hasSavedConversation = loadConversationState();
messages[0].content = buildSystemPrompt();

if (hasSavedConversation && messages.length > 1) {
  restoreChatWindowFromMemory();
}

if (!userProfile.name) {
  displayMessage(
    "assistant",
    "Bonjour. I can help you discover L'Oreal makeup, skincare, haircare, and fragrances, and build a personalized routine. What is your name?",
  );
} else if (!hasSavedConversation || messages.length <= 1) {
  displayMessage(
    "assistant",
    `Bonjour ${userProfile.name}. I can help you discover L'Oreal makeup, skincare, haircare, and fragrances, and build a personalized routine.`,
  );
}

renderQuickPrompts();
renderCategoryFilters();
renderPresetGoals();
