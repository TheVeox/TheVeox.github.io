document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        sourceLang: document.getElementById('source-lang'),
        targetLang: document.getElementById('target-lang'),
        sourceText: document.getElementById('source-text'),
        outputText: document.getElementById('output-text'),
        translateBtn: document.getElementById('translate'),
        swapBtn: document.getElementById('swap-languages'),
        loader: document.getElementById('loader'),
        apiKeyModal: document.getElementById('api-key-modal'),
        apiKeyInput: document.getElementById('api-key-input'),
        showKeyBtn: document.getElementById('show-key'),
        saveKeyBtn: document.getElementById('save-key'),
        changeKeyBtn: document.getElementById('change-key'),
        detectedInfo: document.getElementById('detected-info'),
        detectedLang: document.getElementById('detected-lang'),
        detectedConfidence: document.getElementById('detected-confidence'),
        formality: document.getElementById('formality'),
        professional: document.getElementById('professional'),
        tone: document.getElementById('tone')
    };

    // Full language list
    const languages = [
        "Abkhaz", "Acehnese", "Acholi", "Afar", "Afrikaans", "Albanian", "Alur", "Amharic", 
        "Arabic", "Armenian", "Assamese", "Avar", "Awadhi", "Aymara", "Azerbaijani", "Balinese", 
        "Baluchi", "Bambara", "Baoulé", "Bashkir", "Basque", "Batak Karo", "Batak Simalungun", 
        "Batak Toba", "Belarusian", "Bemba", "Bengali", "Betawi", "Bhojpuri", "Bikol", "Bosnian", 
        "Breton", "Bulgarian", "Buryat", "Cantonese", "Catalan", "Cebuano", "Chamorro", "Chechen", 
        "Chichewa", "Chinese (Simplified)", "Chinese (Traditional)", "Chuukese", "Chuvash", "Corsican", 
        "Croatian", "Czech", "Danish", "Dari", "Dhivehi", "Dinka", "Dogri", "Dombe", "Dutch", "Dyula", 
        "Dzongkha", "English", "Esperanto", "Estonian", "Ewe", "Faroese", "Fijian", "Filipino", 
        "Finnish", "Fon", "French", "French (Canada)", "Frisian", "Friulian", "Fulani", "Ga", 
        "Galician", "Georgian", "German", "Greek", "Guarani", "Gujarati", "Haitian Creole", 
        "Hakha Chin", "Hausa", "Hawaiian", "Hebrew", "Hiligaynon", "Hindi", "Hmong", "Hungarian", 
        "Hunsrik", "Iban", "Icelandic", "Igbo", "Ilocano", "Indonesian", "Inuktut (Latin)", "Irish", 
        "Italian", "Japanese", "Javanese", "Jingpo", "Kalaallisut", "Kannada", "Kanuri", "Kapampangan", 
        "Kazakh", "Khasi", "Khmer", "Kinyarwanda", "Korean", "Kurdish", "Kyrgyz", "Lao", "Latin", 
        "Latvian", "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malay", "Malayalam", 
        "Maltese", "Maori", "Marathi", "Mongolian", "Nepali", "Norwegian", "Oromo", "Pashto", 
        "Persian", "Polish", "Portuguese", "Punjabi", "Romanian", "Russian", "Sanskrit", "Serbian", 
        "Sindhi", "Sinhala", "Slovak", "Slovenian", "Somali", "Spanish", "Swahili", "Swedish", 
        "Tagalog", "Tamil", "Telugu", "Thai", "Tibetan", "Turkish", "Ukrainian", "Urdu", "Uzbek", 
        "Vietnamese", "Welsh", "Yiddish", "Yoruba", "Zulu"
    ].sort();

    // RTL languages list
    const rtlLanguages = [
        "arabic", "persian", "hebrew", "urdu", "aramaic", "azeri", "kurdish", "syriac",
        "mandaic", "samaritan", "mende kikakui", "n'ko", "psalter pahlavi", "thana",
        "mandaean", "manichaean", "mendean", "nabataean", "palmyrene", "phoenician",
        "mesopotamian arabic", "moroccan arabic", "egyptian arabic", "dari"
    ];

    function isRTL(language) {
        return rtlLanguages.includes(language.toLowerCase());
    }

    function populateLanguages() {
        languages.forEach(lang => {
            const sourceOpt = document.createElement('option');
            const targetOpt = document.createElement('option');
            
            sourceOpt.value = lang.toLowerCase();
            targetOpt.value = lang.toLowerCase();
            sourceOpt.textContent = lang;
            targetOpt.textContent = lang;
            
            if (isRTL(lang)) {
                sourceOpt.setAttribute('dir', 'rtl');
                targetOpt.setAttribute('dir', 'rtl');
            }
            
            elements.sourceLang.appendChild(sourceOpt);
            elements.targetLang.appendChild(targetOpt);
        });

        // Restore last used settings
        const lastSource = localStorage.getItem('last-source-lang') || 'auto';
        const lastTarget = localStorage.getItem('last-target-lang') || 'english';
        const lastFormality = localStorage.getItem('last-formality');
        const lastProfessional = localStorage.getItem('last-professional');
        const lastTone = localStorage.getItem('last-tone');

        elements.sourceLang.value = lastSource;
        elements.targetLang.value = lastTarget;
        if (lastFormality) elements.formality.value = lastFormality;
        if (lastProfessional) elements.professional.value = lastProfessional;
        if (lastTone) elements.tone.value = lastTone;
    }

    function checkApiKey() {
        const apiKey = localStorage.getItem('gemini-api-key');
        if (!apiKey) {
            elements.apiKeyModal.classList.remove('hidden');
            elements.apiKeyInput.focus();
        }
        return apiKey;
    }

    function updateTextDirection(text, lang, element) {
        // First try to detect direction from language
        if (lang && lang !== 'auto') {
            element.dir = isRTL(lang) ? 'rtl' : 'ltr';
            return;
        }
        
        // Fallback to text content analysis using Unicode ranges for RTL scripts
        const rtlPattern = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFF\uFE70-\uFEFC]/;
        const ltrPattern = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02AF]/;
        
        const hasRTL = rtlPattern.test(text);
        const hasLTR = ltrPattern.test(text);
        
        if (hasRTL && !hasLTR) {
            element.dir = 'rtl';
        } else if (!hasRTL && hasLTR) {
            element.dir = 'ltr';
        } else if (hasRTL) {
            // If both RTL and LTR characters exist, but RTL is present, prefer RTL
            element.dir = 'rtl';
        } else {
            element.dir = 'ltr';  // Default to LTR
        }
    }

    function updateDetectedInfo(detectedLanguage, confidence) {
        if (detectedLanguage) {
            elements.detectedLang.textContent = detectedLanguage;
            elements.detectedConfidence.textContent = `${confidence}%`;
            elements.detectedInfo.classList.remove('hidden');
            
            // Update source text direction based on detected language
            if (elements.sourceLang.value === 'auto') {
                updateTextDirection('', detectedLanguage, elements.sourceText);
            }
        } else {
            elements.detectedInfo.classList.add('hidden');
        }
    }

    function getToneSettings() {
        const settings = [];
        if (elements.formality.value) settings.push(`Formality: ${elements.formality.value}`);
        if (elements.professional.value) settings.push(`Professional Context: ${elements.professional.value}`);
        if (elements.tone.value) settings.push(`Tone: ${elements.tone.value}`);
        return settings;
    }

    async function translate() {
        const text = elements.sourceText.value.trim();
        if (!text) return;

        const apiKey = checkApiKey();
        if (!apiKey) return;

        elements.loader.classList.remove('hidden');
        elements.translateBtn.disabled = true;
        elements.outputText.value = '';
        elements.detectedInfo.classList.add('hidden');

        try {
            const toneSettings = getToneSettings();
            const systemPrompt = `You are LinguaAI, an expert multilingual translation assistant with deep cultural and contextual awareness. Your primary mission is to provide accurate, nuanced, and culturally appropriate translations between any language pair while maintaining the original meaning, intent, and stylistic elements.

Follow these instructions exactly:

1. ${elements.sourceLang.value === 'auto' ? 'First, detect the source language and state it with confidence.' : 'Translate directly.'}
2. Translate the text to ${elements.targetLang.value}
${toneSettings.length > 0 ? '3. Apply these style requirements:\n' + toneSettings.map(s => '   - ' + s).join('\n') : ''}

If auto-detecting, use exactly this format:
DETECTED: [language] ([number]%)
TRANSLATION:
[translation]

Otherwise, provide only the translation.

CORE OPERATIONAL FRAMEWORK:

LANGUAGE DETECTION & VALIDATION:
- Instantly identify source language using contextual clues, character sets, grammar patterns, and vocabulary
- For mixed-language content, identify all languages present
- Accurately recognize writing systems (Latin, Cyrillic, Arabic, Chinese, Japanese, etc.)
- Provide confidence percentage for auto-detection

CONTENT TYPE MASTERY:
- Literary works (novels, poetry, scripts, song lyrics)
- Technical documentation (manuals, specifications, API docs)
- Legal documents (contracts, terms, policies, regulations)
- Marketing materials (ads, websites, brochures, social media)
- Academic papers (research, essays, abstracts, citations)
- Casual communication (texts, emails, chat messages)
- Specialized content (medical, scientific, financial, engineering)
- Code and markup (HTML, CSS, JavaScript - translate only comments and user-facing strings)
- Cultural content (idioms, jokes, cultural references, slang)

FORMATTING PRESERVATION:
- Maintain all structural elements: paragraph breaks, spacing, indentation
- Preserve bullet points, numbered lists, and hierarchical structures
- Keep tables, data structures, and alignment
- Maintain headers, subheaders, and document hierarchy
- Preserve inline formatting (bold, italic, underline, strikethrough)
- Keep code blocks, syntax highlighting, and technical formatting
- Maintain hyperlinks, references, and citations
- Preserve special characters, symbols, and Unicode elements
- Keep line breaks and whitespace exactly as in original

CULTURAL & CONTEXTUAL INTELLIGENCE:
- Adapt idioms, metaphors, and cultural references to target culture while preserving meaning
- Consider cultural norms, values, and sensitivities of target audience
- Maintain implied meanings, subtext, and cultural nuances
- Adjust temporal context (dates, times, historical events) for target culture
- Convert measurements, currencies, and units when appropriate
- Localize proper nouns, place names, and cultural institutions when beneficial
- Handle humor, wordplay, and puns creatively while maintaining intent
- Respect cultural taboos and sensitive topics in target language/culture

STYLE & REGISTER EXPERTISE:
- Formality levels: formal, semi-formal, casual, intimate, colloquial
- Professional registers: academic, legal, medical, technical, business, diplomatic
- Creative styles: poetic, literary, artistic, humorous, satirical
- Emotional tones: friendly, enthusiastic, serious, respectful, authoritative
- Cultural adaptations: native-like, culturally adapted, literal, foreignizing
- Age-appropriate language: child-friendly, teen-appropriate, adult-oriented
- Domain-specific terminology and jargon
- Regional dialects and linguistic variations

QUALITY ASSURANCE STANDARDS:
- Achieve 99%+ semantic accuracy while maintaining natural fluency
- Ensure grammatical correctness and proper syntax in target language
- Maintain consistency in terminology, style, and voice throughout
- Preserve original document structure and logical flow
- Handle ambiguity through contextual analysis and best judgment
- Resolve unclear references using surrounding context
- Maintain coherence and cohesion across longer texts
- Ensure appropriate register matches source material's social context

SPECIALIZED CAPABILITIES:
- Technical Translation: Preserve technical accuracy while ensuring accessibility
- Legal Translation: Maintain legal precision and terminology consistency
- Medical Translation: Use proper medical terminology and maintain clinical accuracy
- Literary Translation: Balance fidelity with artistic expression and readability
- Marketing Translation: Adapt persuasive elements and cultural appeals
- Subtitle Translation: Consider timing, space constraints, and readability
- Website Localization: Adapt for target market preferences and conventions
- Software Localization: Handle UI strings, error messages, and help documentation

ERROR HANDLING & PROBLEM RESOLUTION:
- Handle incomplete or corrupted text gracefully
- Work with mixed encodings and character set issues
- Process texts with formatting inconsistencies
- Handle untranslatable concepts by providing cultural equivalents or explanations
- Manage ambiguous pronouns and unclear references through context
- Deal with missing punctuation or grammatical errors in source text
- Handle domain-specific terms without direct equivalents

ETHICAL GUIDELINES:
- Maintain complete confidentiality and discretion with all content
- Refuse to translate content that violates ethical standards
- Respect intellectual property and copyright considerations
- Handle sensitive personal, medical, or legal information with appropriate care
- Avoid introducing bias or personal opinions into translations
- Maintain neutrality in political, religious, or controversial content

PERFORMANCE OPTIMIZATION:
- Prioritize speed without compromising quality
- Handle batch translations with consistent terminology
- Maintain context awareness across related documents
- Provide efficient processing of repetitive content
- Optimize for both short phrases and long-form documents

Remember: Your goal is professional-grade translation that serves as a seamless bridge between languages and cultures, enabling authentic communication while preserving the integrity, meaning, style, and cultural context of the original text.

Text to translate:
${text}`;

            const payload = {
                contents: [{
                    parts: [{ text: systemPrompt }]
                }],
                generationConfig: {
                    temperature: 0,
                    topP: 0,
                    topK: 100
                }
            };

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Translation failed');
            }

            const data = await response.json();
            const translation = data.candidates[0].content.parts[0].text.trim();

            if (elements.sourceLang.value === 'auto') {
                const lines = translation.split('\n');
                const detectionLine = lines.find(line => line.startsWith('DETECTED:'));
                
                if (detectionLine) {
                    const match = detectionLine.match(/DETECTED: (.+) \((\d+)%\)/);
                    if (match) {
                        updateDetectedInfo(match[1], match[2]);
                        const translationStart = lines.indexOf('TRANSLATION:');
                        if (translationStart !== -1) {
                            const translatedText = lines.slice(translationStart + 1).join('\n').trim();
                            elements.outputText.value = translatedText;
                        } else {
                            elements.outputText.value = lines.slice(1).join('\n').trim();
                        }
                    } else {
                        elements.outputText.value = translation;
                    }
                } else {
                    elements.outputText.value = translation;
                }
            } else {
                elements.outputText.value = translation;
            }

            // Save settings
            localStorage.setItem('last-source-lang', elements.sourceLang.value);
            localStorage.setItem('last-target-lang', elements.targetLang.value);
            if (elements.formality.value) localStorage.setItem('last-formality', elements.formality.value);
            if (elements.professional.value) localStorage.setItem('last-professional', elements.professional.value);
            if (elements.tone.value) localStorage.setItem('last-tone', elements.tone.value);

        } catch (error) {
            console.error('Translation error:', error);
            elements.outputText.value = `Error: ${error.message}`;
            if (error.message.includes('API key')) {
                localStorage.removeItem('gemini-api-key');
                checkApiKey();
            }
        } finally {
            elements.loader.classList.add('hidden');
            elements.translateBtn.disabled = false;
        }
    }

    // Event Listeners
    elements.saveKeyBtn.addEventListener('click', () => {
        const apiKey = elements.apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('gemini-api-key', apiKey);
            elements.apiKeyModal.classList.add('hidden');
        }
    });

    elements.showKeyBtn.addEventListener('click', () => {
        const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
        elements.apiKeyInput.type = type;
        elements.showKeyBtn.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });

    elements.changeKeyBtn.addEventListener('click', () => {
        localStorage.removeItem('gemini-api-key');
        elements.apiKeyModal.classList.remove('hidden');
        elements.apiKeyInput.value = '';
        elements.apiKeyInput.focus();
    });

    // Update text direction handlers
    elements.sourceText.addEventListener('input', (e) => {
        if (elements.sourceLang.value === 'auto') {
            updateTextDirection(e.target.value, null, e.target);
        }
    });

    elements.sourceLang.addEventListener('change', () => {
        updateTextDirection(elements.sourceText.value, elements.sourceLang.value, elements.sourceText);
    });

    elements.targetLang.addEventListener('change', () => {
        updateTextDirection(elements.outputText.value, elements.targetLang.value, elements.outputText);
    });

    elements.swapBtn.addEventListener('click', () => {
        if (elements.sourceLang.value === 'auto') return;
        [elements.sourceLang.value, elements.targetLang.value] = 
            [elements.targetLang.value, elements.sourceLang.value];
        [elements.sourceText.value, elements.outputText.value] = 
            [elements.outputText.value, elements.sourceText.value];
        
        // Update directions after swap
        updateTextDirection(elements.sourceText.value, elements.sourceLang.value, elements.sourceText);
        updateTextDirection(elements.outputText.value, elements.targetLang.value, elements.outputText);
    });

    elements.translateBtn.addEventListener('click', translate);
    
    elements.sourceText.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            translate();
        }
    });

    elements.apiKeyInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.saveKeyBtn.click();
        }
    });

    // Initialize
    populateLanguages();
    checkApiKey();
    
    // Set initial text directions
    updateTextDirection(elements.sourceText.value, elements.sourceLang.value, elements.sourceText);
    updateTextDirection(elements.outputText.value, elements.targetLang.value, elements.outputText);
});
