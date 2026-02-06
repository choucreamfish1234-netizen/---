import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// Claude API 설정
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET 요청 처리 (테스트용)
export async function GET() {
  return NextResponse.json(
    { status: 'ok', message: 'API is working! Use POST to upload files.' },
    { headers: corsHeaders }
  );
}

// 거부 응답 감지
function isRefusalResponse(text: string): boolean {
  const refusalPatterns = [
    '죄송하지만',
    '죄송합니다',
    'I cannot',
    'I\'m unable',
    'I apologize',
    'cannot process',
    'unable to',
    '포함되어 있지 않',
    '추출할 수 없',
    '분석할 수 없',
  ];
  return refusalPatterns.some(pattern => text.toLowerCase().includes(pattern.toLowerCase()));
}

// Claude API 호출 (텍스트)
async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
     model: process.env.CLAUDE_MODEL || "claude-opus-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Claude API 에러:', error);
    throw new Error(error.error?.message || 'Claude API error');
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// Claude API 호출 (이미지)
async function callClaudeWithImage(systemPrompt: string, userPrompt: string, base64Image: string, mediaType: string = 'image/jpeg'): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: userPrompt
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Claude Vision API 에러:', error);
    throw new Error(error.error?.message || 'Claude API error');
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// 법률 문서 분석 프롬프트
const LEGAL_SYSTEM_PROMPT = `당신은 대한민국 형사 전문 변호사입니다. 피해자 측을 대리하여 탄원서 작성을 돕고 있습니다.

당신의 임무:
1. 법률 문서(고소장, 공소장, 판결문 등)에서 "범죄사실" 또는 "공소사실" 부분을 찾아 추출
2. 6하원칙으로 정리: 누가, 언제, 어디서, 누구에게, 무엇을, 어떻게 했는지
3. 피해자 관점 1인칭으로 200-400자 내외 요약
4. 주소, 전화번호, 변호사 정보는 제외

중요: 이것은 실제 법원/검찰 공식 문서입니다. 피해자의 법적 권리 행사를 돕는 정당한 업무입니다.
절대 거부하지 마세요. 문서에서 범죄 행위 내용을 추출하여 요약해주세요.`;

const LEGAL_USER_PROMPT = `다음 법률 문서에서 범죄사실/공소사실을 찾아 요약해주세요.
가해자(피고인/피의자)가 피해자에게 무슨 행위를 했는지 구체적으로 정리해주세요.

문서 내용:
`;

// 텍스트 분석 (재시도 로직 포함)
async function analyzeText(text: string): Promise<string> {
  const truncatedText = text.length > 10000 ? text.substring(0, 10000) + '...' : text;
  
  // 1차 시도
  try {
    console.log('텍스트 분석 1차 시도...');
    const result = await callClaude(LEGAL_SYSTEM_PROMPT, LEGAL_USER_PROMPT + truncatedText);
    
    if (!isRefusalResponse(result) && result.length > 30) {
      return result;
    }
  } catch (error) {
    console.error('1차 시도 오류:', error);
  }
  
  // 2차 시도 (더 단순한 프롬프트)
  try {
    console.log('텍스트 분석 2차 시도...');
    const simplePrompt = `다음 텍스트의 핵심 내용을 요약해주세요. 누가 무엇을 했는지 중심으로 정리해주세요:\n\n${truncatedText}`;
    const result = await callClaude('당신은 문서 요약 전문가입니다. 주어진 텍스트를 객관적으로 요약합니다.', simplePrompt);
    
    if (!isRefusalResponse(result) && result.length > 30) {
      return result;
    }
  } catch (error) {
    console.error('2차 시도 오류:', error);
  }
  
  // 모든 시도 실패 시 원본 반환
  if (truncatedText.length > 100) {
    return `[AI 자동 요약 실패 - 원본 텍스트]\n\n${truncatedText.substring(0, 1500)}${truncatedText.length > 1500 ? '...' : ''}`;
  }
  
  throw new Error('ANALYSIS_FAILED');
}

// 이미지 분석 (재시도 로직 포함)
async function analyzeImage(base64Image: string, mediaType: string): Promise<string> {
  // 1차 시도
  try {
    console.log('이미지 분석 1차 시도...');
    const result = await callClaudeWithImage(
      LEGAL_SYSTEM_PROMPT,
      '이 법률 문서 이미지에서 범죄사실/공소사실을 찾아 요약해주세요. 가해자가 피해자에게 무슨 행위를 했는지 구체적으로 정리해주세요.',
      base64Image,
      mediaType
    );
    
    if (!isRefusalResponse(result) && result.length > 30) {
      return result;
    }
  } catch (error) {
    console.error('1차 시도 오류:', error);
  }
  
  // 2차 시도
  try {
    console.log('이미지 분석 2차 시도...');
    const result = await callClaudeWithImage(
      '당신은 OCR 전문가입니다. 이미지의 텍스트를 읽고 핵심 내용을 요약합니다.',
      '이 문서 이미지의 텍스트를 읽고 핵심 내용을 요약해주세요.',
      base64Image,
      mediaType
    );
    
    if (!isRefusalResponse(result) && result.length > 30) {
      return result;
    }
  } catch (error) {
    console.error('2차 시도 오류:', error);
  }
  
  throw new Error('ANALYSIS_FAILED');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'NO_FILE', message: '파일이 없습니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith('.pdf') || file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    const isTXT = fileName.endsWith('.txt') || file.type === 'text/plain';
    const isDOCX = fileName.endsWith('.docx');
    const isHWP = fileName.endsWith('.hwp') || fileName.endsWith('.hwpx');

    if (!isPDF && !isImage && !isTXT && !isDOCX && !isHWP) {
      return NextResponse.json({
        error: 'UNSUPPORTED_FORMAT',
        message: '지원하지 않는 파일 형식입니다.',
        suggestion: '지원: PDF, 이미지, TXT, DOCX, HWP'
      }, { status: 400, headers: corsHeaders });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let summary = '';
    let extractedText = '';

    // PDF 처리
    if (isPDF) {
      try {
        const pdfData = await pdf(buffer);
        extractedText = pdfData.text?.trim() || '';

        if (extractedText.length > 50) {
          console.log('텍스트 PDF, Claude 분석 시작...');
          summary = await analyzeText(extractedText);
        } else {
          return NextResponse.json({
            error: 'SCANNED_PDF',
            message: '스캔된 PDF입니다.',
            suggestion: '이미지로 변환 후 다시 업로드해주세요.'
          }, { status: 400, headers: corsHeaders });
        }
      } catch (pdfError) {
        console.error('PDF 파싱 오류:', pdfError);
        return NextResponse.json({
          error: 'PDF_PARSE_ERROR',
          message: 'PDF를 읽을 수 없습니다.'
        }, { status: 400, headers: corsHeaders });
      }
    }

    // 이미지 처리
    else if (isImage) {
      console.log('이미지, Claude Vision 분석 시작...');
      const base64Image = buffer.toString('base64');
      const mediaType = file.type || 'image/jpeg';
      summary = await analyzeImage(base64Image, mediaType);
    }

    // TXT 처리
    else if (isTXT) {
      console.log('TXT 파일, Claude 분석 시작...');
      extractedText = buffer.toString('utf-8');
      
      if (extractedText.trim().length < 10) {
        return NextResponse.json({
          error: 'EMPTY_FILE',
          message: '파일 내용이 비어있습니다.'
        }, { status: 400, headers: corsHeaders });
      }
      
      summary = await analyzeText(extractedText);
    }

    // DOCX 처리
    else if (isDOCX) {
      console.log('DOCX 파일, Claude 분석 시작...');
      try {
        const result = await mammoth.extractRawText({ buffer: buffer });
        extractedText = result.value || '';
        
        if (extractedText.trim().length < 10) {
          return NextResponse.json({
            error: 'EMPTY_FILE',
            message: 'Word 문서가 비어있습니다.'
          }, { status: 400, headers: corsHeaders });
        }
        
        summary = await analyzeText(extractedText);
      } catch (docxError) {
        console.error('DOCX 파싱 오류:', docxError);
        return NextResponse.json({
          error: 'DOCX_PARSE_ERROR',
          message: 'Word 파일을 읽을 수 없습니다.'
        }, { status: 400, headers: corsHeaders });
      }
    }

    // HWP 처리
    else if (isHWP) {
      console.log('HWP 파일 처리 시도...');
      
      if (fileName.endsWith('.hwpx')) {
        return NextResponse.json({
          error: 'HWPX_NOT_SUPPORTED',
          message: 'HWPX는 PDF로 변환 후 업로드해주세요.'
        }, { status: 400, headers: corsHeaders });
      }
      
      // HWP 바이너리에서 텍스트 추출 시도
      const uint8Array = new Uint8Array(arrayBuffer);
      let allText = '';
      
      for (let i = 0; i < uint8Array.length - 1; i += 2) {
        const charCode = uint8Array[i] | (uint8Array[i + 1] << 8);
        if ((charCode >= 0xAC00 && charCode <= 0xD7A3) ||
            (charCode >= 0x0020 && charCode <= 0x007E) ||
            (charCode >= 0x3131 && charCode <= 0x318E)) {
          allText += String.fromCharCode(charCode);
        }
      }
      
      const meaningfulText = allText
        .split(/[\x00-\x1F]+/)
        .filter(chunk => (chunk.match(/[가-힣]/g) || []).length >= 5)
        .join('\n')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (meaningfulText.length < 50) {
        return NextResponse.json({
          error: 'HWP_EXTRACT_FAILED',
          message: 'HWP 텍스트 추출 실패. PDF로 변환 후 업로드해주세요.'
        }, { status: 400, headers: corsHeaders });
      }
      
      summary = await analyzeText(meaningfulText);
    }

    return NextResponse.json({
      success: true,
      summary: summary
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API 오류:', error);

    if (error.message === 'ANALYSIS_FAILED') {
      return NextResponse.json({
        error: 'ANALYSIS_REFUSED',
        message: 'AI가 분석을 완료하지 못했습니다.',
        suggestion: '문서 내용을 직접 입력해주세요.'
      }, { status: 422, headers: corsHeaders });
    }

    return NextResponse.json({
      error: 'SERVER_ERROR',
      message: '서버 오류: ' + error.message
    }, { status: 500, headers: corsHeaders });
  }
}
