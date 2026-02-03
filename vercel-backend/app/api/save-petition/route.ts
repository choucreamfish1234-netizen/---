import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ovwiifodraqeybuwxkyv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92d2lpZm9kcmFxZXlidXd4a3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNjQwMTEsImV4cCI6MjA1MzY0MDAxMX0.6qoOcy5wHNnpZMgtH-0PgQJOPy4foGcM8db4I8mi3zA';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, customerPhone, customerEmail, caseNumber, defendant, crimeTypes, isVictim, relationToVictim, planId, planName, amount, orderId, petitionContent, crimeSummary, fileUrl } = body;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/petitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        customer_name: customerName || '익명',
        customer_phone: customerPhone || '',
        customer_email: customerEmail || '',
        case_number: caseNumber || '',
        defendant: defendant || '',
        crime_types: crimeTypes || '',
        is_victim: isVictim !== false,
        relation_to_victim: relationToVictim || '',
        plan_id: planId || 'basic',
        plan_name: planName || '기본 검토',
        amount: amount || 0,
        order_id: orderId || `ORDER_${Date.now()}`,
        content: petitionContent || '',
        petition_content: petitionContent || '',
        crime_summary: crimeSummary || '',
        file_url: fileUrl || '',
        status: 'submitted',
        source: 'jinsimmugae_app'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ success: false, message: '저장 실패', error: errorText }, { status: 400, headers: corsHeaders });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, message: '저장 완료', petitionId: data[0]?.id }, { headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: '서버 오류', error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ success: true, message: 'save-petition API 작동 중' }, { headers: corsHeaders });
}
