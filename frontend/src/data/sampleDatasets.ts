/**
 * Sample datasets for onboarding and demonstration
 * These datasets are stored in /public/samples/ and can be loaded directly
 */

export interface SampleDataset {
  id: string;
  name: string;
  filename: string;
  description: string;
  icon: 'chart-bar' | 'trending-up' | 'mouse-pointer';
  category: 'business' | 'finance' | 'marketing';
  suggestedCharts: string[];
  fields: {
    name: string;
    description: string;
  }[];
}

export const sampleDatasets: SampleDataset[] = [
  {
    id: 'sales-data',
    name: 'Sales Data',
    filename: 'sales_data.csv',
    description: 'Regional sales performance with revenue, units, and profit by product category',
    icon: 'chart-bar',
    category: 'business',
    suggestedCharts: [
      'Revenue by Region (bar chart)',
      'Sales trend over time (line chart)',
      'Product category breakdown (pie chart)',
    ],
    fields: [
      { name: 'Date', description: 'Transaction date' },
      { name: 'Region', description: 'Sales region (North, South, East, West)' },
      { name: 'Product', description: 'Product name' },
      { name: 'Category', description: 'Product category' },
      { name: 'Revenue', description: 'Total revenue in dollars' },
      { name: 'Units', description: 'Number of units sold' },
      { name: 'Profit', description: 'Profit margin in dollars' },
    ],
  },
  {
    id: 'stock-prices',
    name: 'Stock Prices',
    filename: 'stock_prices.csv',
    description: 'Daily stock price data with OHLC values and trading volume',
    icon: 'trending-up',
    category: 'finance',
    suggestedCharts: [
      'Price trend over time (line chart)',
      'Volume analysis (bar chart)',
      'Compare stocks (multi-line chart)',
    ],
    fields: [
      { name: 'Date', description: 'Trading date' },
      { name: 'Symbol', description: 'Stock ticker symbol' },
      { name: 'Open', description: 'Opening price' },
      { name: 'High', description: 'Highest price of the day' },
      { name: 'Low', description: 'Lowest price of the day' },
      { name: 'Close', description: 'Closing price' },
      { name: 'Volume', description: 'Trading volume' },
      { name: 'Change_Percent', description: 'Daily change percentage' },
    ],
  },
  {
    id: 'website-analytics',
    name: 'Website Analytics',
    filename: 'website_analytics.csv',
    description: 'Website traffic and conversion metrics by page and traffic source',
    icon: 'mouse-pointer',
    category: 'marketing',
    suggestedCharts: [
      'Visitors by page (bar chart)',
      'Conversion funnel (funnel chart)',
      'Traffic sources comparison (pie chart)',
    ],
    fields: [
      { name: 'Date', description: 'Date of the metrics' },
      { name: 'Page', description: 'Page name (Homepage, Products, Pricing, Blog)' },
      { name: 'Source', description: 'Traffic source (Organic, Paid)' },
      { name: 'Visitors', description: 'Number of unique visitors' },
      { name: 'Page_Views', description: 'Total page views' },
      { name: 'Bounce_Rate', description: 'Percentage of single-page sessions' },
      { name: 'Avg_Session_Duration', description: 'Average session duration in seconds' },
      { name: 'Conversions', description: 'Number of conversions' },
      { name: 'Conversion_Rate', description: 'Conversion rate percentage' },
    ],
  },
];

/**
 * Load a sample dataset from the public folder
 * @param filename - The filename of the sample dataset
 * @returns Promise with the CSV text content
 */
export async function loadSampleDataset(filename: string): Promise<string> {
  const response = await fetch(`/samples/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load sample dataset: ${filename}`);
  }
  return response.text();
}
