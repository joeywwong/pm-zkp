const express = require('express');
const { exec, execFile} = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5010;

// Price cache to avoid repeated API calls
const priceCache = new Map();

const db = new sqlite3.Database(path.join(__dirname, 'tx_metrics.db'));

app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from Express!!!' });
});

app.post("/api/requestPayload", async (req, res) => {
  const { type, attribute, schema, operatorStr, valueParam, tokenID, contextParam, attributeType } = req.body;
  if (!type || !attribute || !schema || operatorStr === undefined || valueParam === undefined || tokenID === undefined || contextParam === undefined || !attributeType) {
    return res.status(400).json({ error: "Missing one or more required fields in request body" });
  }

  const tmpPath = path.join(__dirname, "iden3_repo", `schema-${Date.now()}.json`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(schema, null, 2), "utf-8");
  } catch (err) {
    return res.status(500).json({ error: "Failed to write temp schema file" });
  }

  const args = [
    "hardhat",
    "--network", "polygon-amoy",
    "testRequest_with_go",
    type,
    attribute,
    tmpPath,
    operatorStr,
    valueParam,
    tokenID.toString(),
    contextParam,
    attributeType
  ];

  execFile("npx", args, { cwd: path.resolve(__dirname, "iden3_repo") }, (error, stdout, stderr) => {
    if (error) {
      // Try to parse error details from stderr or stdout
      let errorMsg = stderr || stdout || error.message;
      return res.status(500).json({ error: errorMsg });
    }
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      res.json({ output: stdout });
    }
  });
});

function logFee({ operation_name, tx_hash, runtime, gas_fee }) {
  db.run(
    'INSERT INTO tx_logs (operation_name, tx_hash, runtime, gas_fee) VALUES (?, ?, ?, ?)',
    [operation_name, tx_hash, runtime, gas_fee],
    function(err) {
      if (err) console.error('DB log error:', err);
    }
  );
}

app.post('/api/logTx', (req, res) => {
  const { operation_name, tx_hash, runtime, gas_fee } = req.body;
  if (!operation_name || !tx_hash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  logFee({ operation_name, tx_hash, runtime, gas_fee });
  res.json({ status: 'logged' });
});

// Enhanced endpoint with EUR conversion and rate limiting
app.get('/api/txFees', async (req, res) => {
  const { period } = req.query;
  
  let whereClause = '';
  const now = new Date();
  
  switch(period) {
    case '24h':
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      whereClause = `WHERE datetime(timestamp) >= datetime('${last24h.toISOString()}')`;
      break;
    case '30d':
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      whereClause = `WHERE datetime(timestamp) >= datetime('${last30d.toISOString()}')`;
      break;
    case '1y':
      const last1y = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      whereClause = `WHERE datetime(timestamp) >= datetime('${last1y.toISOString()}')`;
      break;
    case 'all':
    default:
      whereClause = '';
      break;
  }

  const query = `
    SELECT 
      operation_name, 
      tx_hash, 
      runtime, 
      gas_fee, 
      timestamp,
      rowid as id 
    FROM tx_logs 
    ${whereClause}
    ORDER BY timestamp
  `;

  try {
    // Get transaction data
    const rows = await new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (rows.length === 0) {
      return res.json({ data: [] });
    }

    // Get unique dates for price fetching
    const uniqueDates = [...new Set(rows.map(row => {
      const date = new Date(row.timestamp);
      return date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
    }))];

    console.log('Unique dates to fetch:', uniqueDates);

    // Function to fetch price with delay and caching
    const fetchPriceWithDelay = async (date, index) => {
      // Check cache first
      if (priceCache.has(date)) {
        console.log(`Using cached price for ${date}`);
        return { date, price: priceCache.get(date) };
      }

      // Add delay between requests (1 second per request)
      await new Promise(resolve => setTimeout(resolve, index * 1000));

      try {
        const ddMmYyyy = date.split('-').reverse().join('-'); // Convert to DD-MM-YYYY
        console.log(`Fetching price for ${date} (formatted as ${ddMmYyyy})`);
        
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/polygon-ecosystem-token/history`, {
          params: {
            date: ddMmYyyy,
            localization: false
          },
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const price = response.data.market_data?.current_price?.eur || 0.35;
        
        // Cache the result
        priceCache.set(date, price);
        
        console.log(`Successfully fetched price for ${date}: €${price}`);
        
        return { date, price };
      } catch (error) {
        console.warn(`Failed to fetch price for ${date}:`, error.response?.status, error.message);
        
        // Use fallback price
        const fallbackPrice = 0.35;
        priceCache.set(date, fallbackPrice);
        
        return { date, price: fallbackPrice };
      }
    };

    // Fetch prices with delays to respect rate limits
    const priceData = [];
    for (let i = 0; i < uniqueDates.length; i++) {
      const priceResult = await fetchPriceWithDelay(uniqueDates[i], i);
      priceData.push(priceResult);
    }

    const priceMap = priceData.reduce((acc, { date, price }) => {
      acc[date] = price;
      return acc;
    }, {});

    // Add EUR conversion to each row
    const enhancedRows = rows.map(row => {
      const date = new Date(row.timestamp).toISOString().split('T')[0];
      const polPrice = priceMap[date] || 0.35; // Fallback price
      const feeInPol = parseFloat(row.gas_fee) || 0;
      const feeInEur = feeInPol * polPrice;
      
      return {
        ...row,
        gas_fee_eur: feeInEur.toFixed(6),
        pol_price: polPrice
      };
    });

    res.json({ data: enhancedRows });
  } catch (error) {
    console.error('DB query error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Serve static files (for the HTML chart page)
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
