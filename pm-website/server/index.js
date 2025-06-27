const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;
//const { prepareRequestParams } = require('./iden3_repo/dist/prepareRequestParams');

app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from Express!!!' });
});

app.get('/requestParams', (req, res) => {
  const schemaJson = JSON.stringify(req.body.schema);
  const fieldName  = req.body.field;

  try {
    const output = prepareRequestParams(schemaJson, fieldName);
    // parse if needed, e.g. split lines
    res.send(output);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
