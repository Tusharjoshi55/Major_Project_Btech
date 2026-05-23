/**
 * Web Search Service using DuckDuckGo Lite
 * Fetches real-time web search results without requiring external API keys.
 */

/**
 * Searches the web for a given query and returns the top 4 results.
 * @param {string} query 
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export const search = async (query) => {
  try {
    console.log(`🌐 [WEB SEARCH] Querying web for: "${query}"...`);
    const response = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      body: `q=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo responded with status: ${response.status}`);
    }

    const html = await response.text();
    const results = [];
    const parts = html.split("class='result-link'");

    // Skip the first part (header info)
    for (let i = 1; i < parts.length && results.length < 4; i++) {
      const part = parts[i];

      // Extract URL and Title
      const urlMatch = part.match(/href="([^"]+)"/) || part.match(/href='([^']+)'/);
      const titleMatch = part.match(/>([^<]+)<\/a>/);

      // Extract Snippet
      const snippetMatch = part.match(/class="result-snippet">([\s\S]*?)<\/td>/) ||
        part.match(/class='result-snippet'>([\s\S]*?)<\/td>/);

      if (urlMatch && titleMatch) {
        let snippet = snippetMatch ? snippetMatch[1] : '';
        // Clean HTML tags from snippet
        snippet = snippet.replace(/<[^>]*>/g, '').trim();
        // Decode HTML entities
        const decodeEntities = (str) => {
          return str
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");
        };

        results.push({
          title: decodeEntities(titleMatch[1].trim()),
          url: urlMatch[1],
          snippet: decodeEntities(snippet)
        });
      }
    }

    console.log(`🌐 [WEB SEARCH] Found ${results.length} web search results.`);
    return results;
  } catch (err) {
    console.error("❌ [WEB SEARCH] Failed to search the web:", err.message);
    return [];
  }
};