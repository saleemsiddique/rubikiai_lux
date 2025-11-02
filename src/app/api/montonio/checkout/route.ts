import jwt from 'jsonwebtoken';
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

interface CustomerData {
  name: string;
  email: string;
  phone?: string;
}

interface ExtrasData {
  jacuzzi?: {
    enabled: boolean;
    price?: number;
  };
}

interface RequestBody {
  houseId: string;
  houseSlug?: string;
  start: string;
  end: string;
  guests: number;
  customer: CustomerData;
  extras?: ExtrasData;
  // Nuevos campos opcionales para pricing detallado
  includedBase?: number;
  totalNightsOnly?: number;
  firstNightCharge?: number;
  discountedFirst?: number;
  // Descuentos
  discountKind?: string; // "coupon" | "percent" | ""
  couponId?: string;
  couponCode?: string;
  couponAmountApplied?: string;
  percentId?: string;
  percentCode?: string;
  percentValue?: string;
  // Usuario
  app_user_id?: string;
  arrivalTime?: string;
  comment?: string;
}

interface BillingAddress {
  firstName: string;
  lastName: string;
  email: string;
  addressLine1: string;
  locality: string;
  region: string;
  country: string;
  postalCode: string;
}

interface LineItem {
  name: string;
  quantity: number;
  finalPrice: number;
}

interface PaymentOptions {
  method: string;
  methodDisplay: string;
  methodOptions: {
    paymentDescription: string;
    preferredCountry: string;
  };
  amount: number;
  currency: string;
}

interface MontonioPayload {
  accessKey: string;
  merchantReference: string;
  returnUrl: string;
  notificationUrl: string;
  currency: string;
  grandTotal: number;
  locale: string;
  billingAddress: BillingAddress;
  lineItems: LineItem[];
  payment: PaymentOptions;
  // CRÍTICO: Agregar metadata para que el webhook pueda reconstruir la reserva
  metadata?: {
    [key: string]: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { 
      houseId, 
      houseSlug, 
      start, 
      end, 
      guests, 
      customer, 
      extras,
      includedBase = 2,
      totalNightsOnly = 0,
      firstNightCharge = 0,
      discountedFirst = 0,
      discountKind = "",
      couponId = "",
      couponCode = "",
      couponAmountApplied = "",
      percentId = "",
      percentCode = "",
      percentValue = "",
      app_user_id = "",
      arrivalTime = "",
      comment = ""
    } = body;

    // Validate required fields
    if (!houseId || !start || !end || !guests || !customer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate dates and nights
    const startDate = new Date(start);
    const endDate = new Date(end);
    const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate pricing
    const basePrice: number = calculateBasePrice(houseId, start, end, guests);
    const jacuzziPrice: number = extras?.jacuzzi?.enabled ? (extras.jacuzzi.price || 0) : 0;
    const grandTotal: number = basePrice + jacuzziPrice;
    
    // Calculate discount
    const discountAmount = Number(couponAmountApplied) || 0;
    const discountedGrandTotal = grandTotal - discountAmount;
    const finalAmount = Math.max(discountedGrandTotal, 0);

    // Generate unique merchant reference
    const merchantReference: string = `booking-${houseId}-${Date.now()}`;

    // Calculate extra guests
    const extraGuests = guests > includedBase ? guests - includedBase : 0;

    // Create metadata with ALL reservation data
    const metadata: { [key: string]: string } = {
      // IDs y referencias
      reservationId: merchantReference,
      houseIds: houseId,
      
      // Fechas
      checkIn: start,
      checkOut: end,
      nights: String(nights),
      
      // Huéspedes
      guests: String(guests),
      includedBase: String(includedBase),
      extraGuests: String(extraGuests),
      
      // Pricing
      totalNightsOnly: String(totalNightsOnly || basePrice),
      firstNightCharge: String(firstNightCharge),
      discountedFirst: String(discountedFirst),
      grandTotal: String(grandTotal),
      discountedGrandTotal: String(finalAmount),
      currency: "EUR",
      
      // Jacuzzi
      jacuzziEnabled: String(extras?.jacuzzi?.enabled || false),
      jacuzziFee: String(jacuzziPrice),
      
      // Customer info
      customerEmail: customer.email,
      customerName: customer.name,
      customerPhone: customer.phone || "",
      arrivalTime: arrivalTime || "",
      comment: comment || "",
      
      // Descuentos
      discountKind: discountKind || "",
      couponId: couponId || "",
      couponCode: couponCode || "",
      couponAmountApplied: couponAmountApplied || "",
      percentId: percentId || "",
      percentCode: percentCode || "",
      percentValue: percentValue || "",
      
      // Usuario
      app_user_id: app_user_id || "",
    };

    // Create JWT payload for Montonio
    const payload: MontonioPayload = {
      accessKey: process.env.MONTONIO_ACCESS_KEY!,
      merchantReference: merchantReference,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?ref=${merchantReference}`,
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/montonio/webhook`,
      currency: "EUR",
      grandTotal: parseFloat(finalAmount.toFixed(2)),
      locale: "en",
      billingAddress: {
        firstName: customer.name.split(' ')[0] || 'Guest',
        lastName: customer.name.split(' ').slice(1).join(' ') || 'User',
        email: customer.email,
        addressLine1: "Address Line 1",
        locality: "City",
        region: "Region",
        country: "EE",
        postalCode: "12345"
      },
      lineItems: [
        {
          name: `Accommodation - ${houseSlug || houseId}`,
          quantity: 1,
          finalPrice: parseFloat(basePrice.toFixed(2))
        }
      ],
      payment: {
        method: "paymentInitiation",
        methodDisplay: "Pay with your bank",
        methodOptions: {
          paymentDescription: `Payment for booking ${merchantReference}`,
          preferredCountry: "EE"
        },
        amount: parseFloat(finalAmount.toFixed(2)),
        currency: "EUR"
      },
      // CRÍTICO: incluir metadata en el payload
      metadata: metadata
    };

    // Add jacuzzi as separate line item if enabled
    if (extras?.jacuzzi?.enabled && jacuzziPrice > 0) {
      payload.lineItems.push({
        name: "Private Jacuzzi",
        quantity: 1,
        finalPrice: parseFloat(jacuzziPrice.toFixed(2))
      });
    }

    // Add discount as line item if applicable
    if (discountAmount > 0) {
      payload.lineItems.push({
        name: `Discount ${discountKind === 'coupon' ? `(Code: ${couponCode})` : `(${percentValue}%)`}`,
        quantity: 1,
        finalPrice: parseFloat((-discountAmount).toFixed(2))
      });
    }

    // Generate JWT token
    const token: string = jwt.sign(payload, process.env.MONTONIO_SECRET_KEY!, {
      algorithm: 'HS256',
      expiresIn: '10m'
    });

    // Determine API endpoint based on environment
    const apiUrl: string = process.env.MONTONIO_ENVIRONMENT === 'production'
      ? 'https://stargate.montonio.com/api/orders'
      : 'https://sandbox-stargate.montonio.com/api/orders';

    console.log('Montonio checkout - API URL:', apiUrl);
    console.log('Montonio checkout - Metadata:', metadata);

    // Create order with Montonio
    const response = await axios.post(
      apiUrl,
      { data: token },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MONTONIO_ACCESS_KEY}`
        },
        timeout: 30000
      }
    );

    // NO guardamos nada en la base de datos aquí
    // La reserva se creará en el webhook cuando el pago sea exitoso

    return NextResponse.json({
      url: response.data.paymentUrl,
      merchantReference: merchantReference,
      montonio: response.data
    });
  } catch (error: any) {
    console.error('Montonio checkout error:', error);

    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    }

    return NextResponse.json(
      { error: error.response?.data?.message || 'Checkout failed' },
      { status: error.response?.status || 500 }
    );
  }
}

// Helper function to calculate base price (replace with your logic)
function calculateBasePrice(houseId: string, start: string, end: string, guests: number): number {
  // This is a placeholder - replace with your actual pricing calculation
  const startDate = new Date(start);
  const endDate = new Date(end);
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const baseRatePerNight = 100; // Replace with your actual rate
  const extraGuestFee = guests > 2 ? (guests - 2) * 20 : 0;

  return (baseRatePerNight * nights) + extraGuestFee;
}