import { exec } from 'child_process';
import { platform } from 'os';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';

export class RSSManager {
    constructor() {
        this.platform = platform();
        this.isWindows = this.platform === 'win32';
        this.cacheDir = path.join(process.cwd(), 'backend', 'rss', 'cache');
        this.feeds = {
            tech_science: [
                "https://www.polsatnews.pl/rss/technologie.xml",
                "https://naukawpolsce.pl/technologia/rss.xml",
                "https://naukawpolsce.pl/naukowy/rss.xml",
                "https://www.polsatnews.pl/rss/czysta-polska.xml",
                "https://gry.interia.pl/feed"
            ],
            world: [
                "https://www.polsatnews.pl/rss/swiat.xml",
                "https://www.tvn24.pl/najwazniejsze.xml"
            ],
            business: [
                "https://www.polsatnews.pl/rss/biznes.xml",
                "https://www.pb.pl/rss/najnowsze.xml",
                "https://biznes.interia.pl/feed",
                "https://www.pb.pl/rss/najnowsze.xml?utm_source=RSS&utm_medium=RSS&utm_campaign=Z%20ostatniej%20chwili",
                "https://www.bankier.pl/rss/wiadomosci.xml",
                "https://www.money.pl/rss/"
            ],
            sport: [
                "https://www.polsatnews.pl/rss/sport.xml",
                "https://sportowefakty.wp.pl/rss.xml",
            ]
            };

        this.initializeCache();
    }

    async initializeCache() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create RSS cache directory:', error);
        }
    }

    async fetchFeed(url) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (response) => {
                let data = '';
                
                response.setEncoding('utf8');
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    resolve(data);
                });
            });
            
            request.on('error', (error) => {
                reject(error);
            });
            
            request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    parseRSSFeed(xmlData) {
        try {
            const items = [];
            const itemRegex = /<item>(.*?)<\/item>/gs;
            const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s;
            const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s;
            const linkRegex = /<link>(.*?)<\/link>/s;
            const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/s;
            const authorRegex = /<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>|<dc:creator>(.*?)<\/dc:creator>|<author>(.*?)<\/author>/s;
            const guidRegex = /<guid(?:[^>]*)>(.*?)<\/guid>/s;

            let match;
            while ((match = itemRegex.exec(xmlData)) !== null) {
                const itemXml = match[1];
                
                const titleMatch = titleRegex.exec(itemXml);
                const descMatch = descRegex.exec(itemXml);
                const linkMatch = linkRegex.exec(itemXml);
                const pubDateMatch = pubDateRegex.exec(itemXml);
                const authorMatch = authorRegex.exec(itemXml);
                const guidMatch = guidRegex.exec(itemXml);

                const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : 'Untitled';
                const rawDescription = descMatch ? (descMatch[1] || descMatch[2] || '').trim() : '';
                const link = linkMatch ? linkMatch[1].trim() : '';
                const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();
                const rawAuthor = authorMatch ? (authorMatch[1] || authorMatch[2] || authorMatch[3] || '').trim() : 'Autor nieznany';
                const guid = guidMatch ? guidMatch[1].trim() : '';

                const title = this.decodeHtmlEntities(rawTitle);
                const description = this.decodeHtmlEntities(rawDescription);
                const author = this.decodeHtmlEntities(rawAuthor);

                if (title && title !== 'Untitled' && description) {
                    const parsedContent = this.parseHTMLContent(description);
                    
                    items.push({
                        title,
                        summary: parsedContent.summary,
                        fullContent: parsedContent.fullContent,
                        htmlContent: description,
                        link,
                        author: author === 'noreply@blogger.com (Unknown)' || author === '' ? 'Autor nieznany' : author,
                        timestamp: pubDate,
                        guid: guid || link
                    });
                }
            }

            return items.slice(0, 15);
        } catch (error) {
            console.error('Error parsing RSS feed:', error);
            return [];
        }
    }

    decodeHtmlEntities(text) {
        if (!text) return text;
        
        const entityMap = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&apos;': "'",
            '&nbsp;': ' ',
            '&#x105;': 'ą',
            '&#x107;': 'ć',
            '&#x119;': 'ę',
            '&#x142;': 'ł',
            '&#x144;': 'ń',
            '&#xF3;': 'ó',
            '&#x15B;': 'ś',
            '&#x17A;': 'ź',
            '&#x17C;': 'ż',
            '&#x104;': 'Ą',
            '&#x106;': 'Ć',
            '&#x118;': 'Ę',
            '&#x141;': 'Ł',
            '&#x143;': 'Ń',
            '&#xD3;': 'Ó',
            '&#x15A;': 'Ś',
            '&#x179;': 'Ź',
            '&#x17B;': 'Ż',
            '&#261;': 'ą',
            '&#263;': 'ć',
            '&#281;': 'ę',
            '&#322;': 'ł',
            '&#324;': 'ń',
            '&#243;': 'ó',
            '&#347;': 'ś',
            '&#378;': 'ź',
            '&#380;': 'ż',
            '&#260;': 'Ą',
            '&#262;': 'Ć',
            '&#280;': 'Ę',
            '&#321;': 'Ł',
            '&#323;': 'Ń',
            '&#211;': 'Ó',
            '&#346;': 'Ś',
            '&#377;': 'Ź',
            '&#379;': 'Ż'
        };

        let decoded = text;
        for (const [entity, char] of Object.entries(entityMap)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), char);
        }

        decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
            return String.fromCharCode(parseInt(num, 10));
        });

        decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
        });

        return decoded;
    }

    parseHTMLContent(htmlContent) {
        const textOnly = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const summary = textOnly.substring(0, 300) + (textOnly.length > 300 ? '...' : '');
        
        let fullContent = htmlContent;
        
        fullContent = fullContent
            .replace(/<iframe[^>]*>.*?<\/iframe>/gs, '')
            .replace(/<script[^>]*>.*?<\/script>/gs, '')
            .replace(/<style[^>]*>.*?<\/style>/gs, '')
            .replace(/<noscript[^>]*>.*?<\/noscript>/gs, '')
            .replace(/<img[^>]*>/g, '');
        
        fullContent = fullContent
            .replace(/<div[^>]*style="text-align: left;"[^>]*>/g, '\n')
            .replace(/<p[^>]*>/g, '\n\n')
            .replace(/<\/p>/g, '')
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/g, (match, level, content) => {
                const cleanContent = this.decodeHtmlEntities(content.replace(/<[^>]*>/g, '').trim());
                const underline = '='.repeat(Math.min(cleanContent.length, 50));
                return `\n\n${cleanContent}\n${underline}\n`;
            })
            .replace(/<b[^>]*>(.*?)<\/b>/g, '$1')
            .replace(/<strong[^>]*>(.*?)<\/strong>/g, '$1')
            .replace(/<i[^>]*>(.*?)<\/i>/g, '$1')
            .replace(/<em[^>]*>(.*?)<\/em>/g, '$1')
            .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '$2')
            .replace(/<li[^>]*>(.*?)<\/li>/g, (match, content) => {
                const cleanContent = this.decodeHtmlEntities(content.replace(/<[^>]*>/g, '').trim());
                return `• ${cleanContent}\n`;
            })
            .replace(/<ul[^>]*>|<\/ul>/g, '\n')
            .replace(/<ol[^>]*>|<\/ol>/g, '\n')
            .replace(/<div[^>]*>|<\/div>/g, '\n')
            .replace(/<span[^>]*font-family:[^>]*>(.*?)<\/span>/g, '$1')
            .replace(/<span[^>]*>|<\/span>/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\n\s*\n\s*\n/g, '\n\n') 
            .replace(/^\s+|\s+$/g, '')
            .trim();

        fullContent = this.decodeHtmlEntities(fullContent);

        return {
            summary: this.decodeHtmlEntities(summary),
            fullContent
        };
    }

    async fetchCategoryNews(category) {
        const feedUrls = this.feeds[category] || [];
        const allItems = [];

        const feedPromises = feedUrls.map(async (url) => {
            try {
                const xmlData = await this.fetchFeed(url);
                const items = this.parseRSSFeed(xmlData);
                
                const sourceName = this.getSourceName(url);
                items.forEach(item => {
                    item.source = sourceName;
                });
                
                return items;
            } catch (error) {
                console.error(`Failed to fetch RSS feed ${url}:`, error.message);
                return [];
            }
        });

        const feedResults = await Promise.allSettled(feedPromises);
        
        feedResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allItems.push(...result.value);
            }
        });

        allItems.sort((a, b) => b.timestamp - a.timestamp);
        
        const mixedItems = this.mixArticlesBySources(allItems);
        
        if (mixedItems.length >= 5) {
            await this.cacheResults(category, mixedItems);
            return mixedItems.slice(0, 15);
        }

        throw new Error(`Insufficient articles found for category: ${category}`);
    }

    mixArticlesBySources(articles) {
        const sourceGroups = {};
        articles.forEach(article => {
            if (!sourceGroups[article.source]) {
                sourceGroups[article.source] = [];
            }
            sourceGroups[article.source].push(article);
        });

        const mixedArticles = [];
        const sources = Object.keys(sourceGroups);
        let sourceIndex = 0;

        while (mixedArticles.length < articles.length && sources.some(source => sourceGroups[source].length > 0)) {
            const currentSource = sources[sourceIndex];
            
            if (sourceGroups[currentSource].length > 0) {
                mixedArticles.push(sourceGroups[currentSource].shift());
            }
            
            sourceIndex = (sourceIndex + 1) % sources.length;
        }

        return mixedArticles;
    }

    getSourceName(url) {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        switch (domain) {
            case "polsatnews.pl": return "Polsat News";
            case "naukawpolsce.pl": return "Nauka w Polsce";
            case "pap-mediaroom.pl": return "PAP";
            case "pb.pl": return "Puls Biznesu";
            case "biznes.interia.pl": return "Interia Biznes";
            case "gry.interia.pl": return "Interia";
            case "sportowefakty.wp.pl": return "WP SportoweFakty";
            case "rss.gazeta.pl": return "Gazeta.pl";
            case "tvn24.pl": return "TVN24";
            case "bankier.pl": return "Bankier.pl";
            case "money.pl": return "Money.pl";
            default:
            return domain.charAt(0).toUpperCase() + domain.slice(1);
        }
    }

    async cacheResults(category, items) {
        try {
            const cacheFile = path.join(this.cacheDir, `${category}.json`);
            const cacheData = {
                timestamp: Date.now(),
                items: items
            };
            await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.error('Failed to cache RSS results:', error);
        }
    }

    async getCachedResults(category) {
        try {
            const cacheFile = path.join(this.cacheDir, `${category}.json`);
            const cacheData = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
            
            const cacheAge = Date.now() - cacheData.timestamp;
            if (cacheAge < 15 * 60 * 1000) {
                return cacheData.items;
            }
        } catch (error) {
        }
        return null;
    }

    async getNews(category = 'tech_science') {
        try {
            const cachedResults = await this.getCachedResults(category);
            if (cachedResults && cachedResults.length >= 5) {
                return cachedResults;
            }

            return await this.fetchCategoryNews(category);
            
        } catch (error) {
            console.error(`Failed to get RSS news for ${category}:`, error);
            throw error;
        }
    }

    async refreshNews(category) {
        return await this.fetchCategoryNews(category);
    }

    async getAllCategories() {
        const categories = ['tech_science', 'world', 'business', 'sport'];
        const results = {};
        
        for (const category of categories) {
            try {
                results[category] = await this.getNews(category);
            } catch (error) {
                console.error(`Failed to get news for ${category}:`, error);
                results[category] = [];
            }
        }
        
        return results;
    }
}