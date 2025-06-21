// ElevenLabs TTS WebSocket utility
const speech = {
    ws: null,
    context: null,
    sourceNode: null,
    speaking: false,
    audioQueue: [],
    currentButton: null,
    abortController: null,
    voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true
    },

    async fetchVoices() {
        const apiKey = localStorage.getItem('eleven-api-key');
        if (!apiKey) {
            alert('Please enter your ElevenLabs API key');
            return [];
        }

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': apiKey
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('eleven-api-key');
                    alert('Invalid or expired API key. Please enter a valid ElevenLabs API key.');
                    document.getElementById('api-key-modal').classList.remove('hidden');
                    document.getElementById('eleven-key-input').focus();
                    throw new Error('Invalid API key');
                }
                throw new Error(`Failed to fetch voices (${response.status})`);
            }
            
            const data = await response.json();
            const voices = data.voices || [];
            
            if (voices.length === 0) {
                alert('No voices found in your ElevenLabs account. Please make sure you have at least one voice available.');
            }
            
            return voices;
        } catch (error) {
            console.error('Error fetching voices:', error);
            if (!error.message.includes('Invalid API key')) {
                alert('Failed to load voices. Please check your internet connection and try again.');
            }
            return [];
        }
    },

    async speak(text, voiceId, button, speed = 1.0) {
        if (this.speaking) {
            this.stop();
            return;
        }

        const apiKey = localStorage.getItem('eleven-api-key');
        if (!apiKey) {
            alert('Please set your ElevenLabs API key');
            return;
        }

        try {
            // Initialize or resume audio context
            if (!this.context) {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
            } else if (this.context.state === 'suspended') {
                await this.context.resume();
            }

            this.speaking = true;
            this.currentButton = button;
            button.classList.add('speaking');
            this.audioQueue = [];
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            alert('Failed to initialize audio. Please ensure audio playback is allowed.');
            this.stop();
            return;
        }

        try {
            // Use the streaming REST API endpoint instead of WebSocket
            const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream', {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        ...this.voiceSettings,
                        speed: parseFloat(speed)
                    }
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('eleven-api-key');
                    document.getElementById('api-key-modal').classList.remove('hidden');
                    document.getElementById('eleven-key-input').focus();
                    throw new Error('Invalid or expired API key. Please enter a new API key.');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                }
                throw new Error(`Failed to generate speech (${response.status})`);
            }

            // Process the audio stream with proper error handling and cleanup
            try {
                // Show loading state immediately
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                const reader = response.body.getReader();
                let audioChunks = [];

                // Store AbortController for cleanup
                this.abortController = new AbortController();
                const signal = this.abortController.signal;

                try {
                    while (!signal.aborted) {
                        const {done, value} = await reader.read();
                        if (done) break;
                        audioChunks.push(value);
                    }
                } catch (error) {
                    reader.cancel();
                    throw error;
                } finally {
                    if (signal.aborted) {
                        reader.cancel();
                        throw new Error('Audio processing was cancelled');
                    }
                }

                // Concatenate all audio chunks
                const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
                const audioArray = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of audioChunks) {
                    audioArray.set(chunk, offset);
                    offset += chunk.length;
                }

                // Decode the complete audio data
                try {
                    const audioBuffer = await this.context.decodeAudioData(audioArray.buffer);
                    
                    // Only proceed if we're still in speaking mode (user hasn't stopped)
                    if (this.speaking) {
                        this.audioQueue.push(audioBuffer);
                        if (this.audioQueue.length === 1) {
                            this.playNextInQueue();
                        }
                    }
                } catch (decodeError) {
                    console.error('Error decoding audio:', decodeError);
                    throw new Error('Failed to decode audio data');
                }
            } catch (error) {
                console.error('Error processing audio stream:', error);
                this.stop();
                alert('Failed to process audio. Please try again.');
            }
            

            
        } catch (error) {
            console.error('Speech error:', error);
            this.stop();
        }
    },

    async base64ToArrayBuffer(base64) {
        const response = await fetch(`data:audio/mpeg;base64,${base64}`);
        const buffer = await response.arrayBuffer();
        return buffer;
    },

    playNextInQueue() {
        if (!this.speaking || this.audioQueue.length === 0) {
            this.stop();
            return;
        }

        const buffer = this.audioQueue.shift();
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        
        source.onended = () => {
            if (this.audioQueue.length > 0) {
                this.playNextInQueue();
            } else {
                this.stop();
            }
        };
        
        source.start(0);
        this.sourceNode = source;
    },

    stop() {
        // Cancel any ongoing stream processing
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
            } catch (e) {
                // Ignore errors if audio was already stopped
            }
        }
        
        this.speaking = false;
        this.audioQueue = [];
        this.sourceNode = null;
        
        if (this.currentButton) {
            this.currentButton.classList.remove('speaking');
            this.currentButton.disabled = false;
            this.currentButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            this.currentButton = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
        sourceLang: document.getElementById('source-lang'),
        targetLang: document.getElementById('target-lang'),
        sourceText: document.getElementById('source-text'),
        outputText: document.getElementById('output-text'),
        translateBtn: document.getElementById('translate'),
        swapBtn: document.getElementById('swap-languages'),
        loader: document.getElementById('loader'),
        apiKeyModal: document.getElementById('api-key-modal'),
        saveKeyBtn: document.getElementById('save-key'),
        changeKeyBtn: document.getElementById('change-key'),
        detectedInfo: document.getElementById('detected-info'),
        detectedLang: document.getElementById('detected-lang'),
        detectedConfidence: document.getElementById('detected-confidence'),
        formality: document.getElementById('formality'),
        professional: document.getElementById('professional'),
        tone: document.getElementById('tone'),
        speakSource: document.getElementById('speak-source'),
        speakOutput: document.getElementById('speak-output'),
        sourceVoice: document.getElementById('source-voice'),
        outputVoice: document.getElementById('output-voice'),
        sourceSpeed: document.getElementById('source-speed'),
        outputSpeed: document.getElementById('output-speed'),
        geminiKeyInput: document.getElementById('gemini-key-input'),
        elevenKeyInput: document.getElementById('eleven-key-input'),
        showGeminiKey: document.getElementById('show-gemini-key'),
        showElevenKey: document.getElementById('show-eleven-key')
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

    function checkApiKeys() {
        const geminiKey = localStorage.getItem('gemini-api-key');
        const elevenKey = localStorage.getItem('eleven-api-key');
        if (!geminiKey || !elevenKey) {
            elements.apiKeyModal.classList.remove('hidden');
            if (!geminiKey) {
                elements.geminiKeyInput.focus();
            } else {
                elements.elevenKeyInput.focus();
            }
        }
        return { geminiKey, elevenKey };
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

        const { geminiKey } = checkApiKeys();
        if (!geminiKey) return;

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

Otherwise, provide only the translation. and only translation do not out put
DETECTED: [language] ([number]%)
TRANSLATION:
[translation]


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
- Emotional tones: friendly, conversational, Gen z, enthusiastic, serious, respectful, authoritative
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
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
                            // Only show the translation part, skipping the detection info
                            const translatedText = lines.slice(translationStart + 1).join('\n').trim();
                            elements.outputText.value = translatedText;
                        } else {
                            elements.outputText.value = translation;
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
            if (error.message.includes('API key') || error.message.includes('Failed to fetch voices')) {
                localStorage.removeItem('gemini-api-key');
                localStorage.removeItem('eleven-api-key');
                checkApiKeys();
            }
        } finally {
            elements.loader.classList.add('hidden');
            elements.translateBtn.disabled = false;
        }
    }

    // Event Listeners
    // Initialize voice selection
    const voices = await speech.fetchVoices();
    voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.voice_id;
        option.textContent = `${voice.name} (${voice.labels.accent || 'No accent'})`;
        elements.sourceVoice.appendChild(option.cloneNode(true));
        elements.outputVoice.appendChild(option);
    });

    // Restore voice selections
    const lastSourceVoice = localStorage.getItem('last-source-voice');
    const lastOutputVoice = localStorage.getItem('last-output-voice');
    if (lastSourceVoice) elements.sourceVoice.value = lastSourceVoice;
    if (lastOutputVoice) elements.outputVoice.value = lastOutputVoice;

    elements.saveKeyBtn.addEventListener('click', async () => {
        const geminiKey = elements.geminiKeyInput.value.trim();
        const elevenKey = elements.elevenKeyInput.value.trim();
        
        if (!geminiKey || !elevenKey) {
            alert('Please enter both API keys');
            return;
        }

        // Clear existing voices
        elements.sourceVoice.innerHTML = '<option value="">Loading voices...</option>';
        elements.outputVoice.innerHTML = '<option value="">Loading voices...</option>';
        
        try {
            // Save API keys
            localStorage.setItem('gemini-api-key', geminiKey);
            localStorage.setItem('eleven-api-key', elevenKey);
            
            // Test ElevenLabs API key by fetching voices
            const voices = await speech.fetchVoices();
            
            if (voices.length > 0) {
                elements.apiKeyModal.classList.add('hidden');
                
                // Refresh voice lists
                elements.sourceVoice.innerHTML = '<option value="">Select voice</option>';
                elements.outputVoice.innerHTML = '<option value="">Select voice</option>';
                
                voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.voice_id;
                    option.textContent = `${voice.name} (${voice.labels.accent || 'No accent'})`;
                    elements.sourceVoice.appendChild(option.cloneNode(true));
                    elements.outputVoice.appendChild(option);
                });

                // Restore previously selected voices if they still exist
                const lastSourceVoice = localStorage.getItem('last-source-voice');
                const lastOutputVoice = localStorage.getItem('last-output-voice');
                
                if (lastSourceVoice && voices.some(v => v.voice_id === lastSourceVoice)) {
                    elements.sourceVoice.value = lastSourceVoice;
                }
                
                if (lastOutputVoice && voices.some(v => v.voice_id === lastOutputVoice)) {
                    elements.outputVoice.value = lastOutputVoice;
                }
            }
        } catch (error) {
            console.error('Error saving API keys:', error);
            elements.sourceVoice.innerHTML = '<option value="">Select voice</option>';
            elements.outputVoice.innerHTML = '<option value="">Select voice</option>';
            alert('Failed to verify API keys. Please check your keys and try again.');
        }
    });

    elements.showGeminiKey.addEventListener('click', () => {
        const type = elements.geminiKeyInput.type === 'password' ? 'text' : 'password';
        elements.geminiKeyInput.type = type;
        elements.showGeminiKey.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });

    elements.showElevenKey.addEventListener('click', () => {
        const type = elements.elevenKeyInput.type === 'password' ? 'text' : 'password';
        elements.elevenKeyInput.type = type;
        elements.showElevenKey.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });

    elements.changeKeyBtn.addEventListener('click', () => {
        elements.apiKeyModal.classList.remove('hidden');
        elements.geminiKeyInput.value = '';
        elements.elevenKeyInput.value = '';
        elements.geminiKeyInput.focus();
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

    elements.geminiKeyInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.elevenKeyInput.focus();
        }
    });

    elements.elevenKeyInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.saveKeyBtn.click();
        }
    });

    // Save voice selections when changed
    elements.sourceVoice.addEventListener('change', () => {
        localStorage.setItem('last-source-voice', elements.sourceVoice.value);
    });

    elements.outputVoice.addEventListener('change', () => {
        localStorage.setItem('last-output-voice', elements.outputVoice.value);
    });

    // Speech button event listeners
    elements.speakSource.addEventListener('click', () => {
        const text = elements.sourceText.value.trim();
        const voiceId = elements.sourceVoice.value;
        if (text && voiceId) {
            speech.speak(text, voiceId, elements.speakSource, elements.sourceSpeed.value);
        } else if (!voiceId) {
            alert('Please select a voice first');
        }
    });

    elements.speakOutput.addEventListener('click', () => {
        const text = elements.outputText.value.trim();
        const voiceId = elements.outputVoice.value;
        if (text && voiceId) {
            speech.speak(text, voiceId, elements.speakOutput, elements.outputSpeed.value);
        } else if (!voiceId) {
            alert('Please select a voice first');
        }
    });

    // Stop speech when changing text
    elements.sourceText.addEventListener('input', () => {
        if (speech.speaking) {
            speech.stop();
        }
    });

    elements.outputText.addEventListener('input', () => {
        if (speech.speaking) {
            speech.stop();
        }
    });

    // Initialize API keys if they exist
    const geminiKey = localStorage.getItem('gemini-api-key');
    const elevenKey = localStorage.getItem('eleven-api-key');
    if (geminiKey) elements.geminiKeyInput.value = geminiKey;
    if (elevenKey) elements.elevenKeyInput.value = elevenKey;

    // Initialize
    populateLanguages();
    checkApiKeys();
    
    // Set initial text directions
    updateTextDirection(elements.sourceText.value, elements.sourceLang.value, elements.sourceText);
    updateTextDirection(elements.outputText.value, elements.targetLang.value, elements.outputText);
});
