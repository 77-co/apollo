import yahooFinance from "yahoo-finance2";

export default {
    async execute({ symbol }) {
        const result = await yahooFinance.quoteSummary(symbol);
        return result;
    },
};
