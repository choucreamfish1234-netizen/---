import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Solapi API 설정
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCS1UJLHK1SISQ87';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || '4T1I9QZ32KQBYSW1AYZPXY6R6BO2SDL7';
const FROM_NUMBER = '01048351216'; // 발신번호 = 수신번호 (동일하게!)
const TO_NUMBER = '01048351216';   // 수신번호

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS 요청 처리
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// HMAC-SHA256 서명 생성
function generateSignature(apiSecret: string, date: string, salt: string): string {
  const message = date + salt;
  const hmac = crypto.createHmac('sha256', apiSecret);
  hmac.update(message);
  return hmac.digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, userType, crimeTypes, timestamp, type, plan, price, deadline, email, phone } = body;

    let messageText = '';

    // 메시지 타입에 따라 내용 생성
    if (type === 'review_request') {
      // 전문가 검토 신청 알림
      messageText = `[진심의무게] 🔔 전문가 검토 신청!

📌 상품: ${plan || '미지정'}
💰 결제액: ${price || '0'}원
⏰ 응답기한: ${deadline || '확인필요'}

👤 작성자: ${name || '익명'}
📧 이메일: ${email || '미입력'}
📱 연락처: ${phone || '미입력'}

⚡ 기한 내 검토 완료해주세요!
🕐 ${timestamp || new Date().toLocaleString('ko-KR')}`;
    } else {
      // 탄원서 완성 알림 (기본)
      messageText = `[진심의무게] 새 탄원서 완성!

작성자: ${name || '익명'}
유형: ${userType === 'victim' ? '피해자' : '가족/지인'}
죄명: ${crimeTypes || '미지정'}

시간: ${timestamp || new Date().toLocaleString('ko-KR')}`;
    }

    // Solapi 인증 정보 생성
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const signature = generateSignature(SOLAPI_API_SECRET, date, salt);

    // Solapi API 호출
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`
      },
      body: JSON.stringify({
        message: {
          to: TO_NUMBER,
          from: FROM_NUMBER,
          text: messageText
        }
      })
    });

    const result = await response.json();
    console.log('Solapi 응답:', result);

    if (result.groupId) {
      return NextResponse.json({
        success: true,
        message: '문자 발송 성공',
        groupId: result.groupId
      }, { headers: corsHeaders });
    } else {
      return NextResponse.json({
        success: false,
        message: '문자 발송 실패',
        error: result
      }, { status: 400, headers: corsHeaders });
    }

  } catch (error: any) {
    console.error('SMS 발송 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류',
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}
