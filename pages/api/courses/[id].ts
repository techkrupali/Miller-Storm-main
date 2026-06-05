import type { NextApiRequest, NextApiResponse } from "next";
import { connectMongo } from "../../../src/lib/mongodb";
import { CourseModel } from "../../../src/lib/models/Course";
import { UserModel } from "../../../src/lib/models/User";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  await connectMongo();

  if (req.method === "GET") {
    const { id, userId } = req.query;
    
    console.log('📚 Course detail API called for:', id, 'userId:', userId);
    
    try {
      // Fetch course by ID
      const course = await CourseModel.findOne({ id: id }).lean();
      
      if (!course) {
        console.log('❌ Course not found:', id);
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      console.log('✅ Course found:', course.title);
      console.log('📁 Folders:', course.folders?.length || 0);
      console.log('📄 Pages:', course.pages?.length || 0);

      // Calculate progress if userId provided
      let progress = {
        completedLessons: 0,
        totalLessons: 0,
        progressPercent: 0
      };

      if (course.folders && course.folders.length > 0) {
        // Count total lessons from folders
        progress.totalLessons = course.folders.reduce((total: number, folder: any) => {
          const folderPages = course.pages?.filter((page: any) => page.folderId === folder.id) || [];
          return total + folderPages.length;
        }, 0);
      } else if (course.pages && course.pages.length > 0) {
        // If no folders, count pages directly
        progress.totalLessons = course.pages.length;
      } else if (course.lessonNames && course.lessonNames.length > 0) {
        // Fallback to lessonNames
        progress.totalLessons = course.lessonNames.length;
      }

      // Use web's EXACT API - same as web uses
      if (userId) {
        try {
          // Call web's existing progress API (same as web uses)
          const webApiUrl = `https://millerstorm.tech/api/progress?userId=${userId}&courseId=${id}`;
          console.log('🌐 Calling web progress API:', webApiUrl);
          
          const webResponse = await fetch(webApiUrl);
          if (webResponse.ok) {
            const webProgressData = await webResponse.json();
            
            // Use web's exact calculation logic - only count lesson pages (not quizzes)
            const completedPages = webProgressData.completedPages?.length || 0;
            const lessonPages = course.pages?.filter((p: any) => p.status === 'published' && !p.isQuiz) || [];
            const totalLessonPages = lessonPages.length;
            const progressPercent = totalLessonPages > 0 ? Math.round((completedPages / totalLessonPages) * 100) : 0;
            
            progress.completedLessons = completedPages;
            progress.totalLessons = totalLessonPages;
            progress.progressPercent = progressPercent;
              
            console.log(`✅ Web API result: ${completedPages}/${totalLessonPages} lessons = ${progressPercent}%`);
          }
        } catch (error) {
          console.log('⚠️ Could not call web API:', error);
        }
      }

      const response = {
        ...course,
        progress
      };

      console.log('📊 Progress:', progress);
      res.status(200).json(response);
      return;
    } catch (error) {
      console.error('❌ Error fetching course:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  }

  res.setHeader("Allow", "GET");
  res.status(405).end();
}