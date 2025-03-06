// Example using Express.js
const express = require('express');
const { identityCreation, issueCredential, generateProofs} = require('./zkp.js');

const app = express();

app.get('/identitycreation', async (req, res) => {
    // Capture logs in an array
    const logs = [];
    // Save the original console.log
    const originalLog = console.log;
    // Override console.log to push messages into the logs array
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push(message);
      originalLog.apply(console, args); // Optionally, still log to the server console
    };
  
    // Call the function that logs output
    await identityCreation();
  
    // Restore original console.log
    console.log = originalLog;
  
    // Send captured logs as an HTML response (or JSON, as you prefer)
    res.send(`<pre>${logs.join('\n')}</pre>\n done`);
  });

  app.get('/issue', async (req, res) => {
    // Capture logs in an array
    const logs = [];
    // Save the original console.log
    const originalLog = console.log;
    // Override console.log to push messages into the logs array
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push(message);
      originalLog.apply(console, args); // Optionally, still log to the server console
    };
  
    // Call the function that logs output
    await issueCredential();
  
    // Restore original console.log
    console.log = originalLog;
  
    // Send captured logs as an HTML response (or JSON, as you prefer)
    res.send(`<pre>${logs.join('\n')}</pre>\n done`);
  });

  app.get('/generateproofsandverify', async (req, res) => {
    // Capture logs in an array
    const logs = [];
    // Save the original console.log
    const originalLog = console.log;
    // Override console.log to push messages into the logs array
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push(message);
      originalLog.apply(console, args); // Optionally, still log to the server console
    };
  
    // Call the function that logs output
    await generateProofs();
  
    // Restore original console.log
    console.log = originalLog;
  
    // Send captured logs as an HTML response (or JSON, as you prefer)
    res.send(`<pre>${logs.join('\n')}</pre>\n done`);
  });

// Example specifying the port and starting the server
const port = process.env.PORT || 3000; // You can use environment variables for port configuration
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});