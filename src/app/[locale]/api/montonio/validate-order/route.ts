import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { orderToken } = await req.json();
    
    // Decode the JWT token from Montonio
    const decoded = jwt.verify(orderToken, process.env.MONTONIO_SECRET_KEY || "") as any;
    
    return NextResponse.json({ 
      status: decoded.paymentStatus || 'UNKNOWN'
    });
  } catch (error) {
    console.error('Token validation failed:', error);
    return NextResponse.json({ status: 'INVALID' }, { status: 400 });
  }
}