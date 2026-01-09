// 한글 폰트를 위한 유틸리티
// Noto Sans KR 폰트를 base64로 변환하여 사용
// 폰트 파일은 https://fonts.google.com/noto/specimen/Noto+Sans+KR 에서 다운로드 가능

// 간단한 해결책: 한글 텍스트를 영어로 변환하거나, 
// 또는 실제 폰트 파일을 base64로 변환하여 사용

// 실제 사용 시에는 폰트 파일을 base64로 변환하여 아래에 추가해야 합니다
// 예: const fontBase64 = '...'; // base64 인코딩된 폰트 데이터

export const addKoreanFont = (doc) => {
  // 폰트 파일이 있다면 여기에 추가
  // 예시:
  // const fontBase64 = '...'; // base64 인코딩된 Noto Sans KR 폰트
  // doc.addFileToVFS('NotoSansKR-Regular.ttf', fontBase64);
  // doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
  // doc.setFont('NotoSansKR');
  
  // 임시 해결책: 기본 폰트 사용 (한글이 깨질 수 있음)
  // 실제로는 폰트 파일을 추가해야 합니다
  return doc;
};

// 한글 텍스트를 안전하게 처리하는 함수
export const safeKoreanText = (text) => {
  // 한글이 깨지지 않도록 처리
  // 실제로는 폰트가 필요하지만, 임시로 텍스트 그대로 반환
  return text;
};
