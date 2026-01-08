import React, { useState, useRef } from 'react';
import { uploadConsultation, subscribeToConsultation } from '../api';
import AnalysisResultDisplay from './AnalysisResultDisplay';
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

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      // 파일 확장자로 타입 추론
      const ext = droppedFile.name.split('.').pop().toLowerCase();
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
        } else if (data.type === 'error') {
          setUploadStatus('연결 오류');
          setError(data.error || '연결 중 오류가 발생했습니다.');
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
          <div 
            className="file-upload-area"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="file"
              onChange={handleFileChange}
              disabled={uploading}
              accept=".txt,.doc,.docx,.mp3,.wav,.m4a,.mp4,.avi,.mov"
              className="file-input-hidden"
            />
            <div className="file-upload-content">
              <div className="file-upload-icon">📁</div>
              <div className="file-upload-text">
                {file ? (
                  <>
                    <strong>{file.name}</strong>
                    <span className="file-size">({(file.size / 1024).toFixed(2)} KB)</span>
                  </>
                ) : (
                  <>
                    <span className="file-upload-main-text">파일을 선택하거나 여기에 드래그하세요</span>
                    <span className="file-upload-sub-text">텍스트, 오디오, 비디오 파일 지원</span>
                  </>
                )}
              </div>
              {!file && (
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  disabled={uploading}
                  className="file-select-btn"
                >
                  파일 선택
                </button>
              )}
              {file && (
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  disabled={uploading}
                  className="file-change-btn"
                >
                  변경
                </button>
              )}
            </div>
            {file && fileType && (
              <div className="file-type-badge-upload">
                {fileType === 'audio' ? '🎵 오디오' : fileType === 'video' ? '🎬 비디오' : '📄 텍스트'}
              </div>
            )}
          </div>
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
        <div className="upload-analysis-result">
          <AnalysisResultDisplay analysisResult={analysisResult} />
        </div>
      )}
    </div>
  );
};

export default ConsultationUpload;

