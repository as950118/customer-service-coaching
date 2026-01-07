import React, { useState, useRef } from 'react';
import { uploadConsultation, subscribeToConsultation } from '../api';
import './ConsultationUpload.css';

const ConsultationUpload = ({ onUploadSuccess }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('text');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // 파일 확장자로 타입 추론
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) {
        setFileType('audio');
      } else if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) {
        setFileType('video');
      } else {
        setFileType('text');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!file || !title) {
      setError('제목과 파일을 모두 입력해주세요.');
      return;
    }

    try {
      setUploading(true);
      setUploadStatus('업로드 중...');
      setAnalysisResult(null);
      
      const formData = new FormData();
      formData.append('title', title);
      formData.append('file', file);
      formData.append('file_type', fileType);

      const consultation = await uploadConsultation(formData);
      setUploadStatus('분석 중...');

      // SSE로 실시간 업데이트 구독
      const eventSource = subscribeToConsultation(consultation.id, (data) => {
        if (data.type === 'completed') {
          setUploadStatus('분석 완료!');
          setAnalysisResult(data.analysis_result);
          eventSource.close();
          setUploading(false);
          onUploadSuccess();
          // 폼 초기화
          setTitle('');
          setFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else if (data.type === 'failed') {
          setUploadStatus('분석 실패');
          setError('분석 중 오류가 발생했습니다.');
          eventSource.close();
          setUploading(false);
        } else if (data.type === 'processing') {
          setUploadStatus('분석 중...');
        }
      });
      
    } catch (error) {
      console.error('업로드 실패:', error);
      setUploadStatus(null);
      setError(error.message || '업로드 실패');
      setUploading(false);
    }
  };

  return (
    <div className="consultation-upload">
      <h2>상담 파일 업로드</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">제목</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="상담 제목을 입력하세요"
            disabled={uploading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="file">파일</label>
          <input
            ref={fileInputRef}
            type="file"
            id="file"
            onChange={handleFileChange}
            disabled={uploading}
            accept=".txt,.doc,.docx,.mp3,.wav,.m4a,.mp4,.avi,.mov"
          />
          {file && (
            <div className="file-info">
              선택된 파일: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="fileType">파일 타입</label>
          <select
            id="fileType"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            disabled={uploading}
          >
            <option value="text">텍스트</option>
            <option value="audio">오디오</option>
            <option value="video">비디오</option>
          </select>
        </div>

        <button type="submit" disabled={uploading || !file || !title}>
          {uploading ? '처리 중...' : '업로드 및 분석 시작'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {uploadStatus && (
        <div className={`upload-status ${uploading ? 'processing' : 'completed'}`}>
          {uploading && <span className="spinner"></span>}
          {uploadStatus}
        </div>
      )}

      {analysisResult && (
        <div className="analysis-result">
          <h3>분석 결과</h3>
          <div className="result-content">{analysisResult}</div>
        </div>
      )}
    </div>
  );
};

export default ConsultationUpload;

