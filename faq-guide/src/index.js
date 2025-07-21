/**
 * Genesys Cloud Function for Knowledge Base Search
 *
 * Makes a single API call to:
 * POST /api/v2/knowledge/knowledgebases/{KBId}/documents/search
 *
 *
 * Processes the complex nested JSON response structure to extract
 * readable text from various block types (paragraphs, lists, tables, etc.)
 *
 * Required inputs:
 * - query: string, the search query for the knowledge base
 * - KBId: string, the knowledge base ID
 * - maxArticles: integer, maximum number of articles to return
 * - minConfidence: number, minimum confidence threshold
 * - domain: string, the Genesys Cloud domain (e.g., "mypurecloud.de")
 */

const axios = require('axios');

// --- Schema Definitions ---
const inputSchema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "required": [
        "query",
        "KBId",
        "maxArticles",
        "minConfidence"
    ],
    "properties": {
        "query": { "type": "string", "description": "Input query to the knowledge base" },
        "KBId": { "type": "string", "description": "Knowledge base ID" },
        "maxArticles": { "type": "integer", "description": "Maximum number of articles to return" },
        "minConfidence": { "type": "number", "description": "Minimum confidence threshold" }
    }
};

const outputSchema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "required": ["answer"],
    "properties": {
        "answer": { "type": "string", "description": "The extracted readable answer from the knowledge base" }
    },
    "additionalProperties": false
};


// --- Enhanced Logger Utility ---
/**
 * A simple structured JSON logger.
 * @param {string} requestId - A unique ID for tracing a single function invocation.
 */
const createLogger = (requestId = 'N/A') => {
    const log = (level, message, details = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            requestId,
            level,
            message,
            ...details,
        };
        console.log(JSON.stringify(logEntry));
    };

    return {
        info: (message, details) => log('INFO', message, details),
        warn: (message, details) => log('WARN', message, details),
        error: (message, details) => log('ERROR', message, details),
        debug: (message, details) => log('DEBUG', message, details), // Use for verbose logs
    };
};


// --- Validation and Formatting ---

/**
 * Validates the input payload against the input schema
 */
function validateInput(data) {
    // Check required fields
    for (const requiredProperty of inputSchema.required) {
        if (!(requiredProperty in data)) {
            return `Missing required property: ${requiredProperty}`;
        }
    }

    // Validate types
    for (const propertyName of Object.keys(inputSchema.properties)) {
        const schemaType = inputSchema.properties[propertyName].type;
        if (propertyName in data) {
            if (schemaType === 'string' && typeof data[propertyName] !== 'string') {
                return `Property '${propertyName}' should be a string`;
            } else if (schemaType === 'number' && typeof data[propertyName] !== 'number') {
                return `Property '${propertyName}' should be a number`;
            } else if (schemaType === 'integer' && (!Number.isInteger(data[propertyName]) || typeof data[propertyName] !== 'number')) {
                return `Property '${propertyName}' should be an integer`;
            }
        }
    }

    return null;
}

/**
 * Formats the output according to the output schema
 */
function formatOutput(output, logger) {
    const formattedOutput = {};

    // Copy known properties
    Object.keys(outputSchema.properties).forEach((prop) => {
        if (prop in output) {
            formattedOutput[prop] = output[prop];
        }
    });

    // Check required properties
    for (const requiredProperty of outputSchema.required) {
        if (!formattedOutput.hasOwnProperty(requiredProperty)) {
            logger.error('Missing required output property.', { property: requiredProperty });
            return {
                answer: "Internal error: missing required output property"
            };
        }
    }

    return formattedOutput;
}


// --- Core Logic Functions ---

/**
 * Obtains a Genesys Cloud OAuth token
 */
async function getGenesysCloudToken(domain, credentials, logger) {
    logger.info('Attempting to get Genesys Cloud OAuth token.');
    const gcClientId = credentials?.gcClientId;
    const gcClientSecret = credentials?.gcClientSecret;

    if (!gcClientId || !gcClientSecret) {
        logger.error('Missing Genesys Cloud credentials.');
        throw new Error("Missing gcClientId or gcClientSecret for Genesys Cloud API call");
    }

    const tokenUrl = `https://login.${domain}/oauth/token`;
    logger.info('Requesting token.', { url: tokenUrl, clientId: gcClientId }); // Log client ID but NOT secret

    try {
        const tokenResp = await axios.post(tokenUrl, null, {
            params: { grant_type: "client_credentials" },
            headers: {
                "Authorization": "Basic " + Buffer.from(`${gcClientId}:${gcClientSecret}`).toString('base64')
            }
        });

        const accessToken = tokenResp.data.access_token;
        if (!accessToken) {
            logger.error('Failed to obtain access token from Genesys Cloud. Token was empty.');
            throw new Error("Failed to obtain access token from Genesys Cloud");
        }

        logger.info('Successfully obtained Genesys Cloud access token.');
        return accessToken;
    } catch (err) {
        logger.error('Failed to obtain Genesys Cloud OAuth token.', {
            errorMessage: err.message,
            responseData: err.response?.data
        });
        throw new Error("Failed to obtain Genesys Cloud OAuth token: " + err.message);
    }
}

/**
 * Recursively extracts text from blocks
 */
function extractTextFromBlocks(blocks) {
    if (!blocks || !Array.isArray(blocks)) {
        return '';
    }
    let text = '';
    for (const block of blocks) {
        if (!block || typeof block !== 'object') continue;
        switch (block.type) {
            case 'Text':
                if (block.text && block.text.text) text += block.text.text;
                break;
            case 'Paragraph':
                if (block.paragraph && block.paragraph.blocks) {
                    const paragraphText = extractTextFromBlocks(block.paragraph.blocks);
                    if (paragraphText.trim()) text += paragraphText + '\n\n';
                }
                break;
            case 'UnorderedList':
            case 'OrderedList':
                if (block.list && block.list.blocks) {
                    for (const listItem of block.list.blocks) {
                        if (listItem.type === 'ListItem' && listItem.blocks) {
                            const listItemText = extractTextFromBlocks(listItem.blocks);
                            if (listItemText.trim()) text += '• ' + listItemText + '\n';
                        }
                    }
                    text += '\n';
                }
                break;
            case 'ListItem':
                if (block.blocks) {
                    const listItemText = extractTextFromBlocks(block.blocks);
                    if (listItemText.trim()) text += listItemText;
                }
                break;
            case 'Table':
                if (block.table && block.table.rows) {
                    for (const row of block.table.rows) {
                        if (row.cells) {
                            let rowText = '';
                            for (const cell of row.cells) {
                                if (cell.blocks) {
                                    const cellText = extractTextFromBlocks(cell.blocks);
                                    if (cellText.trim()) rowText += cellText.trim() + ' | ';
                                }
                            }
                            if (rowText.trim()) text += rowText.trim() + '\n';
                        }
                    }
                    text += '\n';
                }
                break;
            case 'Image':
                if (block.image?.properties?.altText) text += `[Image: ${block.image.properties.altText}]\n`;
                break;
            case 'Video':
                text += '[Video content]\n';
                break;
            default:
                if (block.blocks) text += extractTextFromBlocks(block.blocks);
                break;
        }
    }
    return text;
}


/**
 * Extracts readable text from a document variation
 */
function extractTextFromVariation(variation) {
    if (!variation?.body?.blocks) {
        return '';
    }
    return extractTextFromBlocks(variation.body.blocks);
}

/**
 * Processes the knowledge base search response to extract readable text
 */
function processKnowledgeBaseResponse(response, logger) {
    logger.info('Processing knowledge base response.');
    if (!response?.results || !Array.isArray(response.results)) {
        logger.warn('Response has no results array.');
        return 'No results found';
    }

    let combinedAnswer = '';
    logger.info(`Found ${response.results.length} results to process.`);

    for (const [index, result] of response.results.entries()) {
        if (!result.document) {
            logger.warn(`Result at index ${index} has no document object.`);
            continue;
        }
        const document = result.document;
        if (document.variations && Array.isArray(document.variations)) {
            for (const variation of document.variations) {
                const variationText = extractTextFromVariation(variation);
                if (variationText.trim()) {
                    combinedAnswer += variationText.trim() + '\n\n';
                }
            }
        }
    }

    combinedAnswer = combinedAnswer.trim();

    if (!combinedAnswer && response.answerGeneration?.answer) {
        logger.info('No text extracted from blocks, falling back to answerGeneration field.');
        combinedAnswer = response.answerGeneration.answer;
    }

    const finalAnswer = combinedAnswer || 'No content found in the knowledge base results';
    logger.info('Finished processing response.', { answerLength: finalAnswer.length });
    return finalAnswer;
}


/**
 * Calls the knowledge base search API with AnswerHighlight mode
 */
async function searchKnowledgeBase(domain, accessToken, payload, logger) {
    const searchUrl = `https://api.${domain}/api/v2/knowledge/knowledgebases/${payload.KBId}/documents/search?expand=documentVariations`;
    const requestBody = {
        query: payload.query,
        pageSize: payload.maxArticles,
        confidenceThreshold: payload.minConfidence,
        answerMode: ["AnswerHighlight"],
        queryType: "AutoSearch"
    };

    logger.info('Searching knowledge base.', { url: searchUrl, body: requestBody });

    try {
        const response = await axios.post(searchUrl, requestBody, {
            headers: {
                "Authorization": `Bearer ${accessToken}`, // Do not log the token itself
                "Content-Type": "application/json"
            }
        });
        logger.info('Successfully received response from knowledge base search.');
        logger.debug('Full search results from API.', { data: response.data }); // Verbose debug log
        return response.data;
    } catch (err) {
        logger.error('Failed to search knowledge base.', {
            errorMessage: err.message,
            status: err.response?.status,
            responseData: err.response?.data
        });
        throw new Error("Failed to search knowledge base: " + (err.response?.data?.message || err.message));
    }
}

// --- Main Handler ---

exports.handler = async (event, context, callback) => {
    // Extract a request ID for tracing, fallback to a random string
    const requestId = context?.awsRequestId || `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createLogger(requestId);

    logger.info('Function execution started.');
    logger.debug('Received context.', { context });
    logger.debug('Received event.', { event });

    try {
        // Parse input payload
        let payload;
        if (event.rawRequest) {
            try {
                payload = JSON.parse(event.rawRequest);
                logger.info('Parsed rawRequest JSON successfully.');
            } catch (parseErr) {
                logger.error('Failed to parse rawRequest JSON.', { error: parseErr.message, rawRequest: event.rawRequest });
                const errorResponse = formatOutput({ answer: "Invalid JSON input" }, logger);
                return callback(null, errorResponse);
            }
        } else {
            payload = event;
            logger.info('Using event object directly as payload.');
        }

        // Validate input
        const inputError = validateInput(payload);
        if (inputError) {
            logger.warn('Input validation failed.', { error: inputError, payload });
            const errorResponse = formatOutput({ answer: `Invalid input: ${inputError}` }, logger);
            return callback(null, errorResponse);
        }
        logger.info('Input validation successful.');
        logger.debug('Validated payload.', { payload });

        // Extract Genesys Cloud credentials & domain
        const usingHeaders = event.headers && event.headers.gcClientId && event.headers.gcClientSecret;
        const gcCredentials = {
            gcClientId: event.headers?.gcClientId || context.clientContext?.gcClientId,
            gcClientSecret: event.headers?.gcClientSecret || context.clientContext?.gcClientSecret
        };
        const domain = event.headers?.domain || context.clientContext?.domain;
        logger.info('Extracted credentials and domain.', { source: usingHeaders ? 'headers' : 'clientContext' });

        if (!domain) {
            logger.error('Missing domain in headers or client context.');
            const errorResponse = formatOutput({ answer: "Missing domain in headers or client context" }, logger);
            return callback(null, errorResponse);
        }

        // Get OAuth token
        const accessToken = await getGenesysCloudToken(domain, gcCredentials, logger);

        // Search knowledge base
        const searchResults = await searchKnowledgeBase(domain, accessToken, payload, logger);

        // Check if we got results
        if (!searchResults.results || searchResults.results.length === 0) {
            logger.warn('No results found for the query.', { query: payload.query });
            const response = formatOutput({ answer: "No results found for your query." }, logger);
            return callback(null, response);
        }

        // Process the response to extract readable text
        const answer = processKnowledgeBaseResponse(searchResults, logger);

        // Build success response
        const successResponse = formatOutput({ answer }, logger);
        logger.info('Function execution completed successfully.');
        logger.debug('Returning success response.', { successResponse });
        return callback(null, successResponse);

    } catch (err) {
        logger.error('An unexpected error occurred in the main handler.', {
            errorMessage: err.message,
            stack: err.stack
        });
        const errorResponse = formatOutput({ answer: "An internal error occurred." }, logger);
        return callback(null, errorResponse);
    }
};