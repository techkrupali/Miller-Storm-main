import type { NextPage } from "next";
import { ManagerLayout } from "../../src/portals/manager/ManagerLayout";

const TaskManagerPage: NextPage = () => {
  return (
    <ManagerLayout currentView="task-manager">
      <div className="page-header">
        <h1 className="page-title">Task Manager</h1>
      </div>
      <div className="panel">
        <div className="panel-body">
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '400px',
            textAlign: 'center',
            padding: '40px'
          }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '20px',
              opacity: 0.3
            }}>
              ✓
            </div>
            <h2 style={{ 
              fontSize: '32px', 
              fontWeight: 600, 
              color: '#374151',
              marginBottom: '12px'
            }}>
              Coming Soon
            </h2>
            <p style={{ 
              fontSize: '16px', 
              color: '#6b7280',
              maxWidth: '500px'
            }}>
              Task Manager is currently under development. This feature will help you organize and track your team's tasks efficiently.
            </p>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
};

export default TaskManagerPage;
