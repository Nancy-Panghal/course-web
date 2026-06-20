import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendLoggedEmail } from '@/lib/email';
import { slugify } from '@/lib/utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function firstRow(query: any): Promise<any | null> {
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const {
      courseId,
      studentId,
      studentEmail,
      studentName,
      studentPhone,
      couponCode,
    } = await req.json();

    if (!courseId) {
      return NextResponse.json({ error: 'Missing course ID' }, { status: 400 });
    }
    if (!studentPhone && !studentEmail) {
      return NextResponse.json({ error: 'Missing student contact' }, { status: 400 });
    }

    // Get course
    const course = await firstRow(
      supabaseAdmin
        .from('courses')
        .select('*')
        .eq('id', courseId)
    );
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    if (!course.is_published) {
      return NextResponse.json({ error: 'Course not available for enrollment' }, { status: 403 });
    }

    // Check if this is a free course or valid coupon makes it free
    let isFree = course.free_preview_config === 'completely free';
    let appliedCoupon = null;

    if (!isFree && couponCode) {
      const { data: couponRows, error: couponError } = await supabaseAdmin.rpc(
        'validate_coupon_for_course',
        {
          input_course_id: courseId,
          input_coupon_code: couponCode,
        }
      );
      if (couponError) throw couponError;
      
      const coupon = couponRows?.[0];
      if (coupon?.valid && coupon.final_amount <= 0) {
        isFree = true;
        appliedCoupon = coupon;
      }
    }

    if (!isFree) {
      return NextResponse.json({ error: 'This course is not free' }, { status: 400 });
    }

    // Upsert student
    let student: any = null;
    if (studentId) {
      student = await firstRow(
        supabaseAdmin.from('students').select('id').eq('auth_id', studentId)
      );
    }
    if (!student && studentEmail) {
      student = await firstRow(
        supabaseAdmin.from('students').select('id').eq('email', studentEmail)
      );
    }

    if (student) {
      await supabaseAdmin
        .from('students')
        .update({
          email: studentEmail || undefined,
          name: studentName || undefined,
          phone: studentPhone || undefined,
          auth_id: studentId || undefined,
        })
        .eq('id', student.id);
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('students')
        .insert({
          email: studentEmail || null,
          name: studentName || null,
          phone: studentPhone || null,
          auth_id: studentId || null,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      student = inserted;
    }

    // Check existing enrollment
    const phoneOrEmail = studentPhone || studentEmail!;
    let existingEnrollment: any = null;
    if (student?.id) {
      existingEnrollment = await firstRow(
        supabaseAdmin
          .from('enrollments')
          .select('id, payment_status')
          .eq('course_uuid', courseId)
          .eq('student_id', student.id)
      );
    }
    if (!existingEnrollment && phoneOrEmail) {
      existingEnrollment = await firstRow(
        supabaseAdmin
          .from('enrollments')
          .select('id, payment_status')
          .eq('course_uuid', courseId)
          .eq('phone', phoneOrEmail)
      );
    }

    if (existingEnrollment && existingEnrollment.payment_status === 'paid') {
      return NextResponse.json({ success: true, alreadyEnrolled: true });
    }

    const now = new Date().toISOString();
    let enrollmentId: string | null = null;

    if (existingEnrollment) {
      const { error: updateErr } = await supabaseAdmin
        .from('enrollments')
        .update({
          payment_status: 'paid',
          payment_id: 'FREE',
          amount_paid: 0,
          student_id: student?.id || null,
          creator_id: course.creator_id,
          phone: phoneOrEmail,
          last_web_sync: now,
          coupon_id: appliedCoupon?.coupon_id || null,
        })
        .eq('id', existingEnrollment.id);

      if (updateErr) throw updateErr;
      enrollmentId = existingEnrollment.id;
    } else {
      const { data: insertedEnrollment, error: insertEnrollErr } = await supabaseAdmin
        .from('enrollments')
        .insert({
          phone: phoneOrEmail,
          course_uuid: courseId,
          current_lesson: 1,
          student_id: student?.id || null,
          creator_id: course.creator_id,
          amount_paid: 0,
          payment_id: 'FREE',
          payment_status: 'paid',
          completed_lessons: [],
          quiz_results: [],
          last_web_sync: now,
          coupon_id: appliedCoupon?.coupon_id || null,
        })
        .select('id')
        .single();

      if (insertEnrollErr) throw insertEnrollErr;
      enrollmentId = insertedEnrollment?.id || null;
    }

    // Create payment record for tracking
    const existingPayment = await firstRow(
      supabaseAdmin
        .from('payments')
        .select('id')
        .eq('provider', 'FREE')
        .eq('enrollment_id', enrollmentId)
    );

    if (!existingPayment?.id) {
      const { error: paymentInsertError } = await supabaseAdmin
        .from('payments')
        .insert({
          creator_id: course.creator_id,
          course_id: courseId,
          student_id: student?.id || null,
          enrollment_id: enrollmentId,
          provider: 'FREE',
          provider_payment_id: 'FREE',
          provider_order_id: 'FREE',
          buyer_name: studentName || null,
          buyer_email: studentEmail || null,
          buyer_phone: studentPhone || null,
          currency: 'INR',
          gross_amount: course.price,
          discount_amount: course.price,
          net_amount: 0,
          platform_fee: 0,
          creator_earning: 0,
          status: 'paid',
          metadata: {
            source: 'free_enroll',
            coupon_code: appliedCoupon?.coupon_code || null,
          },
          paid_at: now,
        });

      if (paymentInsertError) throw paymentInsertError;
    }

    // Redeem coupon if applicable
    if (appliedCoupon?.coupon_code) {
      const { data: redemptionRows, error: redemptionError } = await supabaseAdmin.rpc(
        'redeem_coupon_for_payment',
        {
          input_coupon_code: appliedCoupon.coupon_code,
          input_course_id: courseId,
          input_creator_id: course.creator_id,
          input_student_id: student?.id || null,
          input_enrollment_id: enrollmentId,
          input_payment_id: 'FREE',
        }
      );

      if (redemptionError) throw redemptionError;

      const redemption = redemptionRows?.[0];
      if (!redemption?.success) {
        console.warn('Coupon redemption failed:', redemption?.reason);
      }
    }

    // Send emails
    await sendLoggedEmail({
      supabase: supabaseAdmin,
      emailType: 'creator_new_enrollment',
      to: course.creator_id, // will use lookup for creator email
      subject: `New enrollment: ${course.name}`,
      creator_id: course.creator_id,
      course_id: courseId,
      payment_id: 'FREE',
      metadata: {
        student_name: studentName || null,
        student_email: studentEmail || null,
        student_phone: studentPhone || null,
      },
    });

    if (studentEmail) {
      const creatorProfile = await firstRow(
        supabaseAdmin
          .from('creators')
          .select('telegram_bot_username, name')
          .eq('id', course.creator_id)
      );

      await sendLoggedEmail({
        supabase: supabaseAdmin,
        emailType: 'student_welcome',
        to: studentEmail,
        subject: `Welcome to ${course.name}`,
        creator_id: course.creator_id,
        student_id: student?.id || null,
        course_id: courseId,
        payment_id: 'FREE',
        metadata: {
          has_telegram: Boolean(creatorProfile?.telegram_bot_username),
          telegram_bot_username: creatorProfile?.telegram_bot_username || null,
        },
      });
    }

    return NextResponse.json({ success: true, alreadyEnrolled: false });

  } catch (err: any) {
    console.error('Free enroll error:', err);
    return NextResponse.json({ error: err.message || 'Enrollment failed' }, { status: 500 });
  }
}
