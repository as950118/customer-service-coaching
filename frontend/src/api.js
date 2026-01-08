// 환경에 따라 API URL 결정 (런타임에 동적으로 결정)
// Vercel 배포 시: 프록시를 통해 /api 사용 (HTTPS → HTTPS)
// 로컬 개발 시: 직접 백엔드 URL 사용
const getApiBaseUrl = () => {
  // 환경 변수가 설정되어 있으면 사용
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 브라우저 환경에서만 window 객체 확인
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Vercel 배포 환경인지 확인
    if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
      // Vercel에서는 프록시를 통해 /api 사용
      return '/api';
    }
    
    // HTTPS로 접속 중이면 프록시 사용 (Mixed Content 방지)
    if (window.location.protocol === 'https:') {
      return '/api';
    }
  }
  
  // 로컬 개발 환경 (HTTP)
  return 'http://localhost:8000/api';
};

// 함수로 export하여 런타임에 동적으로 URL 결정
export const getApiBaseUrlDynamic = getApiBaseUrl;

// 헬퍼 함수: 인증 헤더 가져오기
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const uploadConsultation = async (formData) => {
  const token = localStorage.getItem('access_token');
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${getApiBaseUrl()}/consultations/`, {
    method: 'POST',
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '업로드 실패');
  }
  
  return response.json();
};

export const getConsultations = async (filters = {}) => {
  const token = localStorage.getItem('access_token');
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // 필터 파라미터를 쿼리 스트링으로 변환
  const queryParams = new URLSearchParams();
  if (filters.title) queryParams.append('title', filters.title);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.file_type) queryParams.append('file_type', filters.file_type);
  if (filters.date_from) queryParams.append('date_from', filters.date_from);
  if (filters.date_to) queryParams.append('date_to', filters.date_to);
  
  const url = `${getApiBaseUrl()}/consultations/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  const response = await fetch(url, {
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '조회 실패');
  }
  
  return response.json();
};

export const getConsultation = async (id) => {
  const token = localStorage.getItem('access_token');
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${getApiBaseUrl()}/consultations/${id}/`, {
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '조회 실패');
  }
  
  return response.json();
};

export const subscribeToConsultation = (consultationId, onMessage) => {
  const token = localStorage.getItem('access_token');
  const url = `${getApiBaseUrl()}/consultations/${consultationId}/stream/`;
  
  // EventSource는 헤더를 설정할 수 없으므로 fetch API를 사용하여 스트림 읽기
  const controller = new AbortController();
  
  const fetchStream = async () => {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
        }
        throw new Error(`서버 오류: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 보관
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)); // 'data: ' 제거
              onMessage(data);
              
              // 완료 또는 실패 시 종료
              if (data.type === 'completed' || data.type === 'failed') {
                controller.abort();
                return;
              }
            } catch (e) {
              console.error('JSON 파싱 오류:', e, line);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // 정상적인 종료
        return;
      }
      console.error('SSE 스트림 오류:', error);
      onMessage({ type: 'error', error: error.message });
    }
  };
  
  fetchStream();
  
  // EventSource와 유사한 인터페이스를 제공하기 위한 객체
  return {
    close: () => {
      controller.abort();
    },
    addEventListener: (event, handler) => {
      // 호환성을 위한 빈 구현
    },
  };
};

export const downloadConsultationFile = async (consultationId, fileName) => {
  const token = localStorage.getItem('access_token');
  const url = `${getApiBaseUrl()}/consultations/${consultationId}/download/`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
      }
      if (response.status === 403) {
        throw new Error('다운로드 권한이 없습니다.');
      }
      throw new Error(`다운로드 실패: ${response.status}`);
    }
    
    // Blob으로 변환하여 다운로드
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // Content-Disposition 헤더에서 파일명 추출 시도
    const contentDisposition = response.headers.get('Content-Disposition');
    let downloadFileName = fileName || 'download';
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (fileNameMatch && fileNameMatch[1]) {
        downloadFileName = fileNameMatch[1].replace(/['"]/g, '');
      }
    }
    
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('파일 다운로드 실패:', error);
    throw error;
  }
};

// 인증 관련 API 함수
export const login = async (username, password) => {
  const response = await fetch(`${getApiBaseUrl()}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '로그인 실패');
  }
  
  return response.json();
};

export const register = async (username, email, password, password2) => {
  const response = await fetch(`${getApiBaseUrl()}/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password, password2 }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '회원가입 실패');
  }
  
  return response.json();
};

export const getCurrentUser = async (token) => {
  const response = await fetch(`${getApiBaseUrl()}/auth/me/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || '사용자 정보 조회 실패');
  }
  
  return response.json();
};

