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
}

interface ReservationData {
  merchantReference: string;
  houseId: string;
  start: string;
  end: string;
  guests: number;
  customer: CustomerData;
  extras?: ExtrasData;
  grandTotal: number;
  status: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { houseId, houseSlug, start, end, guests, customer, extras } = body;

    // Validate required fields
    if (!houseId || !start || !end || !guests || !customer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate total amount (replace with your pricing logic)
    const basePrice: number = calculateBasePrice(houseId, start, end, guests);
    const jacuzziPrice: number = extras?.jacuzzi?.enabled ? (extras.jacuzzi.price || 0) : 0;
    const grandTotal: number = basePrice + jacuzziPrice;

    // Generate unique merchant reference
    const merchantReference: string = `booking-${houseId}-${Date.now()}`;

    // Create JWT payload for Montonio
    const payload: MontonioPayload = {
      accessKey: process.env.MONTONIO_ACCESS_KEY!,
      merchantReference: merchantReference,
      returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?ref=${merchantReference}`,
      notificationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/montonio/webhook`,
      currency: "EUR",
      grandTotal: parseFloat(grandTotal.toFixed(2)),
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
          finalPrice: basePrice
        }
      ],
      payment: {
        method: "paymentInitiation",
        methodDisplay: "Pay with your bank",
        methodOptions: {
          paymentDescription: `Payment for booking ${merchantReference}`,
          preferredCountry: "EE"
        },
        amount: parseFloat(grandTotal.toFixed(2)),
        currency: "EUR"
      }
    };

    // Add jacuzzi as separate line item if enabled
    if (extras?.jacuzzi?.enabled && jacuzziPrice > 0) {
      payload.lineItems.push({
        name: "Private Jacuzzi",
        quantity: 1,
        finalPrice: jacuzziPrice
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

    console.log('Montonio checkout payload:', apiUrl);

    // Add this before generating the token
    console.log('JWT Payload:', JSON.stringify(payload, null, 2));

    // Add this after generating the token
    console.log('Generated Token:', token);

    // Add this to see the full request
    console.log('Request body:', JSON.stringify({ data: token }, null, 2));

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

    // Store reservation data in your database here
    await saveReservationData({
      merchantReference,
      houseId,
      start,
      end,
      guests,
      customer,
      extras,
      grandTotal,
      status: 'pending'
    });

    return NextResponse.json({
      url: response.data.paymentUrl,
      merchantReference: merchantReference,
      montonio: response.data
    });
  } catch (error: any) {
    console.error('Montonio checkout error:', error);

    // Add this to see the detailed error from Montonio
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    }
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

// Helper function to save reservation data (replace with your database logic)
async function saveReservationData(reservationData: ReservationData): Promise<boolean> {
  // Replace this with your actual database save logic
  console.log('Saving reservation:', reservationData);

  // Example with a database:
  // await db.collection('reservations').add(reservationData);

  return true;
}