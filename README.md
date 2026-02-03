# 진심의무게 백엔드 API 연동 가이드

## 배포 방법

### 1. Vercel에 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포
vercel
```

### 2. 환경변수 설정

Vercel Dashboard에서:
1. Project Settings → Environment Variables
2. `OPENAI_API_KEY` 추가 (Production, Preview, Development 모두 체크)

---

## API 엔드포인트

### POST /api/analyze-pdf

PDF 또는 이미지 파일을 분석하여 범죄사실을 추출합니다.

#### Request

```javascript
// FormData로 파일 전송
const formData = new FormData();
formData.append('file', file);

const response = await fetch('https://your-vercel-url.vercel.app/api/analyze-pdf', {
  method: 'POST',
  body: formData
});

const data = await response.json();
```

#### Response (성공)

```json
{
  "success": true,
  "summary": "피고인 홍길동은 2024년 1월 1일 서울시 강남구..."
}
```

#### Response (실패 - 분석 거부)

```json
{
  "error": "ANALYSIS_REFUSED",
  "message": "법률 문서의 내용이 민감하여 AI가 분석을 거부했습니다.",
  "suggestion": "문서 내용을 직접 확인하시고 피해 경위를 직접 입력해주세요."
}
```

#### Response (실패 - 스캔 PDF)

```json
{
  "error": "SCANNED_PDF",
  "message": "스캔된 PDF입니다. 이미지로 변환 후 다시 업로드해주세요.",
  "suggestion": "PDF의 각 페이지를 스크린샷으로 캡처하거나 이미지로 내보내기 후 업로드해주세요."
}
```

---

## 프론트엔드 연동 예시 (React)

```javascript
const analyzeDocument = async (file) => {
  setLoading(true);
  setLoadingMessage('문서 분석 중...');
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/analyze-pdf', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 성공 - 요약 텍스트 사용
      setVf({ ...vf, desc: data.summary });
      setCrimeInputMode('direct');
      alert('문서 분석이 완료되었습니다.');
    } else {
      // 실패 처리
      if (data.error === 'SCANNED_PDF') {
        alert(data.message + '\n\n' + data.suggestion);
      } else if (data.error === 'ANALYSIS_REFUSED') {
        alert(data.message + '\n\n' + data.suggestion);
        // 직접 입력 모드로 전환
        setCrimeInputMode('direct');
      } else {
        alert('문서 분석 실패: ' + data.message);
      }
    }
  } catch (error) {
    console.error('분석 오류:', error);
    alert('서버 연결에 실패했습니다.');
  } finally {
    setLoading(false);
  }
};
```

---

## 스캔 PDF 처리 (클라이언트 측)

스캔 PDF는 서버에서 텍스트 추출이 불가능하므로, 클라이언트에서 이미지로 변환 후 재전송해야 합니다.

```javascript
// pdf.js를 사용한 PDF → 이미지 변환
import * as pdfjsLib from 'pdfjs-dist';

const convertPDFToImage = async (pdfFile) => {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  
  const scale = 2;
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  // Canvas를 Blob으로 변환
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], 'page.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  });
};
```

---

## 보안 고려사항

1. **API 키 보호**: OPENAI_API_KEY는 절대 클라이언트에 노출되지 않음
2. **파일 크기 제한**: Vercel 기본 4.5MB (Pro는 50MB)
3. **Rate Limiting**: 필요시 추가 구현 권장
4. **CORS**: 필요시 middleware에서 설정

---

## 문제 해결

### "법률 문서의 내용이 민감하여 AI가 분석을 거부했습니다"

이 에러가 계속 발생하면:
1. 시스템 프롬프트를 더 강화 (route.ts의 ANALYSIS_PROMPTS 수정)
2. 다른 모델 시도 (gpt-4o-mini 등)
3. 최종적으로 사용자에게 직접 입력 유도

### 스캔 PDF 미지원

현재 버전은 텍스트 기반 PDF만 서버에서 처리합니다.
스캔 PDF는 클라이언트에서 이미지로 변환 후 전송해야 합니다.
