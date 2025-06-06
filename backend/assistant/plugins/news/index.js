import { RSSManager } from '../../../rss/index.js';

const rssManager = new RSSManager();

// Category-specific source mappings
const CATEGORY_SOURCES = {
    tech_science: [
        "Polsat News",    // technologie.xml and czysta-polska.xml
        "Nauka w Polsce", // technologia/rss.xml and naukowy/rss.xml
        "Interia"         // gry.interia.pl/feed
    ],
    world: [
        "Polsat News",    // swiat.xml
        "Gazeta.pl",      // gazetawyborcza_swiat.xml
        "TVN24"           // najwazniejsze.xml
    ],
    business: [
        "Polsat News",    // biznes.xml
        "Puls Biznesu",   // najnowsze.xml
        "Interia Biznes", // biznes.interia.pl/feed
        "Bankier.pl",     // wiadomosci.xml
        "Money.pl"        // rss/
    ],
    sport: [
        "Polsat News",     // sport.xml
        "WP SportoweFakty" // sportowefakty.wp.pl/rss.xml
    ]
};

// All valid sources (for 'all' category)
const ALL_SOURCES = [
    ...new Set(Object.values(CATEGORY_SOURCES).flat())
];

export default {
    async execute({ 
        category = 'tech_science',
        max_articles = 10,
        force_refresh = false,
        include_full_content = false,
        source_filter = null
    }) {
        try {
            // Validate source filter if provided
            if (source_filter) {
                const validSources = category === 'all' ? ALL_SOURCES : CATEGORY_SOURCES[category];
                if (!validSources.includes(source_filter)) {
                    throw new Error(`Invalid source filter '${source_filter}' for category '${category}'. Valid sources are: ${validSources.join(', ')}`);
                }
            }

            let articles = [];

            if (category === 'all') {
                const allCategories = await rssManager.getAllCategories();
                articles = Object.values(allCategories).flat();
            } else {
                if (force_refresh) {
                    articles = await rssManager.refreshNews(category);
                } else {
                    articles = await rssManager.getNews(category);
                }
            }

            // Filter by source if specified
            if (source_filter) {
                articles = articles.filter(article => 
                    article.source === source_filter
                );
            }

            // Sort by timestamp (newest first)
            articles.sort((a, b) => b.timestamp - a.timestamp);

            // Limit results
            articles = articles.slice(0, max_articles);

            // Get valid sources for current category
            const validSourcesForCategory = category === 'all' ? ALL_SOURCES : CATEGORY_SOURCES[category];
            const availableSourcesInResults = [...new Set(articles.map(article => article.source))].sort();

            // Format response
            const response = {
                category: category,
                total_articles: articles.length,
                source_filter: source_filter || null,
                retrieved_at: new Date().toISOString(),
                valid_sources_for_category: validSourcesForCategory,
                available_sources_in_results: availableSourcesInResults,
                articles: articles.map(article => {
                    const formattedArticle = {
                        title: article.title,
                        summary: article.summary,
                        source: article.source,
                        author: article.author,
                        link: article.link,
                        guid: article.guid
                    };

                    // Include full content if requested
                    if (include_full_content) {
                        formattedArticle.full_content = article.fullContent;
                        formattedArticle.html_content = article.htmlContent;
                    }

                    return formattedArticle;
                })
            };

            return response;
        } catch (error) {
            throw new Error(`Failed to fetch news data: ${error.message}`);
        }
    }
};