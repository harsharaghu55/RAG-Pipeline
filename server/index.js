import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from 'bullmq'
import { json } from 'node:stream/consumers';
import { getVectorStore } from './vectorStore.js';
import ollama from 'ollama';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  }
})

const upload = multer({ storage: storage });


const app = express();
app.use(cors());

const queue = new Queue("file-upload-queue", {
  connection: {
            host: 'localhost',
            port:  6379
        }
})

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from the server!' });
});

app.post('/upload/pdf', upload.single('pdf'), (req, res) => {
  // Handle PDF upload logic here
  queue.add(
    'file-ready',
    {
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  )
  res.json({ message: 'PDF uploaded successfully!' });
})

app.get('/chat', async (req,res) => {
  const userQuery  = 'what is event loop?'
  const vectorStore = await getVectorStore()
  const ret = vectorStore.asRetriever({
    k: 2,
  })
  const result = await ret.invoke(userQuery)

  const SYSTEM_PROMPT = `
  You are helfull AI Assistant who answeres the user query based ont he available context form pdf file
  ${JSON.stringify}
  `

  const chatResult = await ollama.chat({
    model: 'llama3.2',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT},
      { role: 'user', content: userQuery }
    ]
  })
  return res.json({ result: chatResult.message.content });
})

app.listen(8000, () => {
  console.log('Server is running on port:- 8000');
});