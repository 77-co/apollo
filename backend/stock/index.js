import yahooFinance from 'yahoo-finance2';
import EventEmitter from 'events';
import Store from 'electron-store';

const store = new Store();

export class StockService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            cacheDuration: config.cacheDuration || 5 * 60 * 1000, // 5 minutes default
            quoteCacheDuration: config.quoteCacheDuration || 1 * 60 * 1000, // 1 minute for quotes
            historicalCacheDuration: config.historicalCacheDuration || 30 * 60 * 1000, // 30 minutes for historical
            searchCacheDuration: config.searchCacheDuration || 60 * 60 * 1000, // 1 hour for search
            maxCacheSize: config.maxCacheSize || 1000,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
        };

        this.cache = new Map();
        this.watchlist = store.get('stock.watchlist', []);
        this.portfolios = store.get('stock.portfolios', {});
        
        // Configure yahoo-finance2
        yahooFinance.setGlobalConfig({
            validation: {
                logErrors: false,
                logOptionsErrors: false,
            },
            queue: {
                concurrency: 4,
                timeout: 30000,
            }
        });

        this.startCacheCleanup();
    }

    // Cache management
    _getCacheKey(type, params) {
        return `${type}:${JSON.stringify(params)}`;
    }

    _getCached(key, maxAge = this.config.cacheDuration) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < maxAge) {
            this.emit('cacheHit', { key, age: Date.now() - cached.timestamp });
            return cached.data;
        }
        return null;
    }

    _setCache(key, data) {
        // Implement LRU-like behavior
        if (this.cache.size >= this.config.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
        this.emit('cacheSet', { key, size: this.cache.size });
    }

    _clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.config.cacheDuration * 2) {
                this.cache.delete(key);
            }
        }
    }

    startCacheCleanup() {
        setInterval(() => {
            this._clearExpiredCache();
        }, this.config.cacheDuration);
    }

    // Retry wrapper
    async _retryRequest(fn, attempts = this.config.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === attempts - 1) throw error;
                
                this.emit('retryAttempt', { 
                    attempt: i + 1, 
                    error: error.message,
                    nextRetryIn: this.config.retryDelay * (i + 1)
                });
                
                await new Promise(resolve => 
                    setTimeout(resolve, this.config.retryDelay * (i + 1))
                );
            }
        }
    }

    // Stock quote methods
    async getQuote(symbol) {
        const cacheKey = this._getCacheKey('quote', { symbol });
        const cached = this._getCached(cacheKey, this.config.quoteCacheDuration);
        
        if (cached) return cached;

        try {
            const quote = await this._retryRequest(async () => {
                return await yahooFinance.quote(symbol);
            });

            const processedQuote = this._processQuote(quote);
            this._setCache(cacheKey, processedQuote);
            
            this.emit('quoteRetrieved', { symbol, quote: processedQuote });
            return processedQuote;
        } catch (error) {
            this.emit('error', new Error(`Failed to get quote for ${symbol}: ${error.message}`));
            throw error;
        }
    }

    async getQuotes(symbols) {
        const cacheKey = this._getCacheKey('quotes', { symbols: symbols.sort() });
        const cached = this._getCached(cacheKey, this.config.quoteCacheDuration);
        
        if (cached) return cached;

        try {
            const quotes = await this._retryRequest(async () => {
                return await yahooFinance.quote(symbols);
            });

            const processedQuotes = Array.isArray(quotes) 
                ? quotes.map(quote => this._processQuote(quote))
                : [this._processQuote(quotes)];

            this._setCache(cacheKey, processedQuotes);
            
            this.emit('quotesRetrieved', { symbols, count: processedQuotes.length });
            return processedQuotes;
        } catch (error) {
            this.emit('error', new Error(`Failed to get quotes for ${symbols.join(', ')}: ${error.message}`));
            throw error;
        }
    }

    _processQuote(quote) {
        return {
            symbol: quote.symbol,
            name: quote.longName || quote.shortName,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            marketCap: quote.marketCap,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            open: quote.regularMarketOpen,
            previousClose: quote.regularMarketPreviousClose,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
            currency: quote.currency,
            exchange: quote.exchange,
            marketState: quote.marketState,
            lastUpdated: new Date(),
            raw: quote // Keep raw data for advanced use
        };
    }

    async getHistoricalData(symbol, options = {}) {
        const defaultOptions = {
            period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
            period2: new Date(),
            interval: '1d'
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        const cacheKey = this._getCacheKey('historical', { symbol, ...finalOptions });
        const cached = this._getCached(cacheKey, this.config.historicalCacheDuration);
        
        if (cached) return cached;

        try {
            // Use chart() instead of historical() as per yahoo-finance2 deprecation notice
            const chartData = await this._retryRequest(async () => {
                return await yahooFinance.chart(symbol, {
                    period1: finalOptions.period1,
                    period2: finalOptions.period2,
                    interval: finalOptions.interval
                });
            });

            // Transform chart data to match historical format
            const processedData = {
                symbol,
                data: chartData.quotes.map(quote => ({
                    date: quote.date,
                    open: quote.open,
                    high: quote.high,
                    low: quote.low,
                    close: quote.close,
                    adjClose: quote.adjclose,
                    volume: quote.volume
                })),
                period: finalOptions,
                lastUpdated: new Date()
            };

            this._setCache(cacheKey, processedData);
            
            this.emit('historicalRetrieved', { 
                symbol, 
                dataPoints: processedData.data.length,
                period: finalOptions
            });
            
            return processedData;
        } catch (error) {
            this.emit('error', new Error(`Failed to get historical data for ${symbol}: ${error.message}`));
            throw error;
        }
    }

    // Search functionality
    async search(query, options = {}) {
        const defaultOptions = {
            quotesCount: 10,
            newsCount: 0,
            enableFuzzyQuery: false
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        const cacheKey = this._getCacheKey('search', { query, ...finalOptions });
        const cached = this._getCached(cacheKey, this.config.searchCacheDuration);
        
        if (cached) return cached;

        try {
            const results = await this._retryRequest(async () => {
                return await yahooFinance.search(query, finalOptions);
            });

            const processedResults = {
                query,
                quotes: results.quotes?.map(quote => ({
                    symbol: quote.symbol,
                    name: quote.longname || quote.shortname,
                    type: quote.typeDisp,
                    exchange: quote.exchange,
                    industry: quote.industry,
                    sector: quote.sector
                })) || [],
                news: results.news || [],
                lastUpdated: new Date()
            };

            this._setCache(cacheKey, processedResults);
            
            this.emit('searchCompleted', { 
                query, 
                resultsCount: processedResults.quotes.length 
            });
            
            return processedResults;
        } catch (error) {
            this.emit('error', new Error(`Failed to search for "${query}": ${error.message}`));
            throw error;
        }
    }

    // Market summary
    async getMarketSummary() {
        const cacheKey = this._getCacheKey('market_summary', {});
        const cached = this._getCached(cacheKey, this.config.quoteCacheDuration);
        
        if (cached) return cached;

        try {
            const majorIndices = ['^GSPC', '^DJI', '^IXIC', '^RUT']; // S&P 500, Dow, NASDAQ, Russell 2000
            const quotes = await this.getQuotes(majorIndices);
            
            const summary = {
                indices: quotes,
                lastUpdated: new Date()
            };

            this._setCache(cacheKey, summary);
            return summary;
        } catch (error) {
            this.emit('error', new Error(`Failed to get market summary: ${error.message}`));
            throw error;
        }
    }

    // Watchlist management
    addToWatchlist(symbol) {
        if (!this.watchlist.includes(symbol.toUpperCase())) {
            this.watchlist.push(symbol.toUpperCase());
            store.set('stock.watchlist', this.watchlist);
            this.emit('watchlistUpdated', { action: 'added', symbol, watchlist: this.watchlist });
        }
    }

    removeFromWatchlist(symbol) {
        const index = this.watchlist.indexOf(symbol.toUpperCase());
        if (index > -1) {
            this.watchlist.splice(index, 1);
            store.set('stock.watchlist', this.watchlist);
            this.emit('watchlistUpdated', { action: 'removed', symbol, watchlist: this.watchlist });
        }
    }

    getWatchlist() {
        return this.watchlist;
    }

    async getWatchlistQuotes() {
        if (this.watchlist.length === 0) return [];
        return await this.getQuotes(this.watchlist);
    }

    // Portfolio management
    createPortfolio(name, description = '') {
        const portfolioId = `portfolio_${Date.now()}`;
        this.portfolios[portfolioId] = {
            id: portfolioId,
            name,
            description,
            holdings: [],
            createdAt: new Date(),
            lastUpdated: new Date()
        };
        store.set('stock.portfolios', this.portfolios);
        this.emit('portfolioCreated', { portfolioId, name });
        return portfolioId;
    }

    addToPortfolio(portfolioId, symbol, shares, purchasePrice, purchaseDate = new Date()) {
        if (!this.portfolios[portfolioId]) {
            throw new Error('Portfolio not found');
        }

        const holding = {
            symbol: symbol.toUpperCase(),
            shares: parseFloat(shares),
            purchasePrice: parseFloat(purchasePrice),
            purchaseDate: new Date(purchaseDate),
            addedAt: new Date()
        };

        this.portfolios[portfolioId].holdings.push(holding);
        this.portfolios[portfolioId].lastUpdated = new Date();
        store.set('stock.portfolios', this.portfolios);
        
        this.emit('holdingAdded', { portfolioId, holding });
    }

    async getPortfolioValue(portfolioId) {
        if (!this.portfolios[portfolioId]) {
            throw new Error('Portfolio not found');
        }

        const portfolio = this.portfolios[portfolioId];
        const symbols = [...new Set(portfolio.holdings.map(h => h.symbol))];
        
        if (symbols.length === 0) {
            return {
                totalValue: 0,
                totalCost: 0,
                totalGainLoss: 0,
                totalGainLossPercent: 0,
                holdings: []
            };
        }

        const quotes = await this.getQuotes(symbols);
        const quoteMap = quotes.reduce((acc, quote) => {
            acc[quote.symbol] = quote;
            return acc;
        }, {});

        let totalValue = 0;
        let totalCost = 0;

        const holdingsWithValues = portfolio.holdings.map(holding => {
            const quote = quoteMap[holding.symbol];
            const currentValue = quote ? quote.price * holding.shares : 0;
            const cost = holding.purchasePrice * holding.shares;
            const gainLoss = currentValue - cost;
            const gainLossPercent = cost > 0 ? (gainLoss / cost) * 100 : 0;

            totalValue += currentValue;
            totalCost += cost;

            return {
                ...holding,
                currentPrice: quote?.price || 0,
                currentValue,
                cost,
                gainLoss,
                gainLossPercent,
                quote
            };
        });

        const totalGainLoss = totalValue - totalCost;
        const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

        return {
            portfolio: {
                ...portfolio,
                holdings: holdingsWithValues
            },
            totalValue,
            totalCost,
            totalGainLoss,
            totalGainLossPercent,
            lastUpdated: new Date()
        };
    }

    getPortfolios() {
        return this.portfolios;
    }

    // Utility methods
    clearCache() {
        this.cache.clear();
        this.emit('cacheCleared');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.config.maxCacheSize,
            usage: (this.cache.size / this.config.maxCacheSize) * 100
        };
    }

    // Market status
    async isMarketOpen(exchange = 'NYSE') {
        try {
            // Use SPY as a proxy for US market status
            const quote = await this.getQuote('SPY');
            return quote.marketState === 'REGULAR';
        } catch (error) {
            this.emit('error', new Error(`Failed to check market status: ${error.message}`));
            return false;
        }
    }

    // Bulk operations
    async getBulkQuotes(symbols, batchSize = 10) {
        const results = [];
        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            try {
                const quotes = await this.getQuotes(batch);
                results.push(...quotes);
                
                // Small delay between batches to be respectful to the API
                if (i + batchSize < symbols.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                this.emit('error', new Error(`Failed to get batch quotes: ${error.message}`));
            }
        }
        return results;
    }

    destroy() {
        this.cache.clear();
        this.removeAllListeners();
    }
}

export default StockService;