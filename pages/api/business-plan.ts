import type { NextApiRequest, NextApiResponse } from 'next';
import { connectMongo } from '../../src/lib/mongodb';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { userId, businessPlan, actuals } = req.body;

    console.log('💾 Saving to database:', { userId, businessPlan, actuals });

    try {
      await connectMongo();
      const db = mongoose.connection.db;
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }
      
      const updateData: any = {
        userId,
        updatedAt: new Date()
      };
      
      if (businessPlan) {
        updateData.businessPlan = businessPlan;
      }
      
      if (actuals) {
        updateData.actuals = actuals;
      }
      
      const result = await db.collection('businessPlans').updateOne(
        { userId },
        { $set: updateData },
        { upsert: true }
      );

      console.log('✅ Database save result:', result);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Database save error:', error);
      res.status(500).json({ error: 'Failed to save to database' });
    }
  } else if (req.method === 'GET') {
    const { managerId, userId } = req.query;
    
    try {
      // Get users from existing API - use proper domain
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      const usersResponse = await fetch(`${baseUrl}/api/users`);
      
      if (!usersResponse.ok) {
        throw new Error(`Failed to fetch users: ${usersResponse.status}`);
      }
      
      const users = await usersResponse.json();
      
      console.log('All users:', users.map((u: any) => ({ name: u.name, id: u.id, role: u.role, managerId: u.managerId })));
      
      // Get business plans from database only
      let allBusinessPlans = [];
      
      try {
        await connectMongo();
        const db = mongoose.connection.db;
        if (!db) {
          throw new Error("Database not available");
        }
        const dbPlans = await db.collection('businessPlans').find({}).toArray();
        console.log('Loaded plans from database:', dbPlans.length);
        allBusinessPlans = dbPlans;
      } catch (dbError) {
        console.error('Database error:', dbError instanceof Error ? dbError.message : dbError);
        res.status(500).json({ error: 'Failed to load business plans from database' });
        return;
      }
      
      // If requesting specific user's plan
      if (userId) {
        console.log('🔍 Looking for user with ID:', userId);
        console.log('📋 Available users:', users.map((u: any) => ({ id: u.id, email: u.email, name: u.name })));
        
        // Try to find by id first, then by email as fallback
        let user = users.find((u: any) => u.id === userId);
        if (!user) {
          console.log('⚠️ User not found by ID, trying email lookup...');
          user = users.find((u: any) => u.email === userId);
        }
        
        if (!user) {
          console.error('❌ User not found for ID/Email:', userId);
          res.status(404).json({ 
            error: 'User not found', 
            searchedFor: userId, 
            availableIds: users.map((u: any) => u.id),
            availableEmails: users.map((u: any) => u.email)
          });
          return;
        }
        
        console.log('✅ Found user:', { id: user.id, name: user.name, email: user.email });
        
        // Look for plan using the actual user.id (not the search term)
        const plan = allBusinessPlans.find((p: any) => p.userId === user.id);
        console.log('📦 Found plan:', plan ? 'Yes' : 'No');
        
        const result = [{
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          managerId: user.managerId,
          businessPlan: plan?.businessPlan || null,
          actuals: plan?.actuals || null,
          updatedAt: plan?.updatedAt || null
        }];
        
        console.log('📤 Sending result:', result);
        res.status(200).json(result);
        return;
      }
      
      // Filter sales users by manager (existing logic)
      const salesUsers = users.filter((user: any) => 
        user.role === 'sales' && 
        (managerId ? user.managerId === managerId : true)
      );
      
      console.log('Filtered sales users:', salesUsers.map((u: any) => ({ name: u.name, id: u.id, managerId: u.managerId })));
      
      // Combine user data with business plans
      const plansWithUsers = salesUsers.map((user: any) => {
        const plan = allBusinessPlans.find((p: any) => p.userId === user.id);
        console.log(`Matching user ${user.name} (${user.id}) with plans:`, allBusinessPlans.map((p: any) => p.userId));
        console.log(`Found plan for ${user.name}:`, !!plan);
        
        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          managerId: user.managerId,
          businessPlan: plan?.businessPlan || null,
          actuals: plan?.actuals || null,
          updatedAt: plan ? new Date() : null
        };
      });
      
      console.log('Final result:', plansWithUsers);
      res.status(200).json(plansWithUsers);
    } catch (error) {
      console.error('Business plans fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch business plans: ' + (error instanceof Error ? error.message : 'Unknown error') });
    }
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end();
  }
}