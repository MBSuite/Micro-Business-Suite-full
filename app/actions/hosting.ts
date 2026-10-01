"use server";

import { sql } from "@vercel/postgres";

export async function getHostingPlans() {
  try {
    const { rows } = await sql`SELECT * FROM hosting_plans ORDER BY id DESC`;
    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createHostingPlan(data: {
  plan_code: string;
  name: string;
  description?: string;
  disk_space_mb: number;
  bandwidth_mb: number;
  price_monthly: number;
  price_yearly: number;
}) {
  try {
    await sql`
      INSERT INTO hosting_plans (plan_code, name, description, disk_space_mb, bandwidth_mb, price_monthly, price_yearly)
      VALUES (${data.plan_code}, ${data.name}, ${data.description || null}, ${data.disk_space_mb}, ${data.bandwidth_mb}, ${data.price_monthly}, ${data.price_yearly})
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getHostingSubscriptions() {
  try {
    const { rows } = await sql`
      SELECT s.*, p.name as plan_name, p.plan_code 
      FROM customer_subscriptions s
      LEFT JOIN hosting_plans p ON s.plan_id = p.id
      ORDER BY s.renewal_date ASC
    `;
    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createHostingSubscription(data: {
  contact_id?: number;
  plan_id: number;
  domain_name: string;
  billing_cycle: string;
  price: number;
  start_date: string;
  renewal_date: string;
  server_ip?: string;
  control_panel_username?: string;
  notes?: string;
}) {
  try {
    await sql`
      INSERT INTO customer_subscriptions 
      (contact_id, plan_id, domain_name, billing_cycle, price, start_date, renewal_date, server_ip, control_panel_username, notes, status)
      VALUES 
      (${data.contact_id || null}, ${data.plan_id}, ${data.domain_name}, ${data.billing_cycle}, ${data.price}, ${data.start_date}, ${data.renewal_date}, ${data.server_ip || null}, ${data.control_panel_username || null}, ${data.notes || null}, 'active')
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
