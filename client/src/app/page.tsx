'use client'

import styles from "./page.module.css";
import { Box, Button } from '@chakra-ui/react'
import { FiUpload } from 'react-icons/fi'

export default function Home() {

  const uploadFileHandler =  ( event: React.MouseEvent<HTMLButtonElement> ) => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'application/pdf');
    input.click()
    input.addEventListener('change', async (event) => {
      if (input.files && input.files.length > 0) {
        const formData = new FormData();
        formData.append('pdf', input.files[0]);
        const uploadfile = await fetch('http://localhost:8000/upload/pdf', {
          method: 'POST',
          body: formData,
        })
        const data = await uploadfile.json()
        console.log(data)
      }
    })
  }

  return (
    <div className={styles.page}>
      <Box bg="tomato" w="25%" h="100vh" p={4} color="white" display="flex" alignItems="flex-end">
        <Button colorScheme="teal" size="md" width="100%" onClick={uploadFileHandler} > 
          <FiUpload />
          upload file
        </Button>
      </Box>
      <Box bg="blue.500" h="100vh" w="100%" p={4} color="white">
        This is another Box
      </Box>
    </div>
  );
}
