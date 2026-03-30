import apiClient, { setSession } from "./lib/apiClient";

export const uploadPDF = async (file, metadata = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("className", metadata.className ?? "");
  formData.append("subject", metadata.subject ?? "");

  const res = await apiClient.post("/documents/upload", formData);
  return res.data;
};

export const generateNotes = async (docId) => {
  const res = await apiClient.post(`/documents/generate-notes/${docId}`);
  return res.data;
};

export const fetchNotes = async (docId) => {
  const res = await apiClient.get(`/documents/notes/${docId}`);
  return res.data;
};

export const fetchAllNotes = async () => {
  const res = await apiClient.get("/documents/notes/all");
  return res.data;
};

export const fetchAllDocuments = async () => {
  const res = await apiClient.get("/documents");
  return res.data;
};

export const fetchDocumentFile = async (docId) => {
  const res = await apiClient.get(`/documents/${docId}/file`, {
    responseType: "blob",
  });

  return res.data;
};

export const deleteDocumentById = async (docId) => {
  const res = await apiClient.delete(`/documents/${docId}`);
  return res.data;
};

export const generateQuizForDocument = async (docId) => {
  const res = await apiClient.post(`/documents/quiz/${docId}`);
  return res.data;
};

export const loginUser = async (credentials) => {
  const res = await apiClient.post("/auth/login", credentials);
  setSession(res.data);
  return res.data;
};

export const signupUser = async (credentials) => {
  const res = await apiClient.post("/auth/signup", credentials);
  setSession(res.data);
  return res.data;
};
