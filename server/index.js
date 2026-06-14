import express from 'express';
import cors from 'cors';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });


const app = express();
app.use(cors());

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from the server!' });
});

app.post('/upload/pdf', upload.single('pdf'), (req, res) => {
  // Handle PDF upload logic here
  res.json({ message: 'PDF uploaded successfully!' });
})

app.listen(8000, () => {
  console.log('Server is running on port:- 8000');
});