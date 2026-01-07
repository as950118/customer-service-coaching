const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const uploadConsultation = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/consultations/`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '업로드 실패');
  }
  
  return response.json();
};

export const getConsultations = async () => {
  const response = await fetch(`${API_BASE_URL}/consultations/`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '조회 실패');
  }
  
  return response.json();
};

export const getConsultation = async (id) => {
  const response = await fetch(`${API_BASE_URL}/consultations/${id}/`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '조회 실패');
  }
  
  return response.json();
};

export const subscribeToConsultation = (consultationId, onMessage) => {
  const eventSource = new EventSource(`${API_BASE_URL}/consultations/${consultationId}/stream/`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE 에러:', error);
    eventSource.close();
  };
  
  return eventSource;
};

