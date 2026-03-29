import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000", // adjust if your backend runs elsewhere
});

export const uploadPDF = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await API.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
};

export const generateNotes = async (docId) => {
  const res = await API.post(`/generate-notes/${docId}`);
  return res.data;
};

export const fetchNotes = async (docId) => {
  const res = await API.get(`/notes/${docId}`);
  return res.data;
};