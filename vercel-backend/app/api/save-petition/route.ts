import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 설정 (환경변수로 관리)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ovwiifodraqeybuwxkyv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92d2lpZm9kcmFxZXlidXd4a3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNjQwMTEsImV4cCI6MjA1MzY0MDAxMX0.6qoOcy5wHNnpZMgtH-0PgQJOPy4foGcM8db4I8mi3zA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      // 의뢰인 정보
      customerName,
      customerPhone,
      customerEmail,
      
      // 사건 정보
      caseNumber,
      defendant,
      crimeTypes,
      isVictim, // true: 피해자 본인, false: 가족/지인
      relationToVictim, // 피해자와의 관계 (지인인 경우)
      
      // 결제 정보
      planId, // basic, standard, premium, vip
      planName,
      amount,
      orderId,
      
      // 탄원서 내용
      petitionContent,
      crimeSummary,
      
      // 업로드된 파일 URL (있으면)
      fileUrl,
    } = body;

    // petitions 테이블에 저장
    const { data, error } = await supabase
      .from('petitions')
      .insert({
        // 의뢰인 정보
        customer_name: customerName || '익명',
        customer_phone: customerPhone || '',
        customer_email: customerEmail || '',
        
        // 사건 정보  
        case_number: caseNumber || '',
        defendant: defendant || '',
        crime_types: crimeTypes || '',
        is_victim: isVictim !== false, // 기본값 true
        relation_to_victim: relationToVictim || '',
        
        // 결제 정보
        plan_id: planId || 'basic',
        plan_name: planName || '기본 검토',
        amount: amount || 0,
        order_id: orderId || `ORDER_${Date.now()}`,
        
        // 탄원서 내용
        content: petitionContent || '',
        petition_content: petitionContent || '',
        crime_summary: crimeSummary || '',
        
        // 파일
        file_url: fileUrl || '',
        
        // 상태
        status: 'submitted', // submitted → reviewing → completed
        
        // 메타
        source: 'jinsimmugae_app',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase 저장 오류:', error);
      return NextResponse.json({
        success: false,
        message: '탄원서 저장 실패',
        error: error.message
      }, { status: 400, headers: corsHeaders });
    }

    console.log('탄원서 저장 성공:', data?.id);

    return NextResponse.json({
      success: true,
      message: '탄원서 저장 완료',
      petitionId: data?.id
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류',
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}

// GET: 탄원서 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const petitionId = searchParams.get('id');
    const orderId = searchParams.get('orderId');

    if (!petitionId && !orderId) {
      return NextResponse.json({
        success: false,
        message: 'id 또는 orderId 필요'
      }, { status: 400, headers: corsHeaders });
    }

    let query = supabase.from('petitions').select('*');
    
    if (petitionId) {
      query = query.eq('id', petitionId);
    } else if (orderId) {
      query = query.eq('order_id', orderId);
    }

    const { data, error } = await query.single();

    if (error) {
      return NextResponse.json({
        success: false,
        message: '탄원서 조회 실패',
        error: error.message
      }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json({
      success: true,
      petition: {
        id: data.id,
        status: data.status,
        feedback: data.feedback,
        reviewedAt: data.reviewed_at,
        reviewedBy: data.reviewed_by
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '서버 오류',
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}
