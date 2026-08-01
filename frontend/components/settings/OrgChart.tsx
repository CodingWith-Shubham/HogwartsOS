import React from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import { Card } from '@/components/ui/card';

interface Employee {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
}

interface OrgChartProps {
  employees: Employee[];
}

interface TreeNodeData {
  employee: Employee;
  children: TreeNodeData[];
}

const StyledNode = ({ employee }: { employee: Employee }) => {
  return (
    <div className="inline-flex flex-col items-center justify-center p-4 border border-border bg-card shadow-sm rounded-lg min-w-[160px] mx-2 hover:border-primary/50 transition-colors">
      <h3 className="font-semibold text-sm text-foreground truncate w-[140px] text-center" title={employee.name}>
        {employee.name}
      </h3>
      <div className="mt-2 flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-primary">
          {employee.role === 'manager' ? 'Super Admin' : employee.role}
        </span>
        {employee.designation && (
          <span className="text-[11px] text-muted-foreground truncate w-[140px] text-center" title={employee.designation}>
            {employee.designation}
          </span>
        )}
      </div>
    </div>
  );
};

export function OrgChart({ employees }: OrgChartProps) {
  const managers = employees.filter(emp => emp.role === 'manager');
  const admins = employees.filter(emp => emp.role === 'admin');
  const sales = employees.filter(emp => emp.role === 'sales');
  const editors = employees.filter(emp => emp.role === 'editor');
  const shoots = employees.filter(emp => emp.role === 'shoot');

  const DepartmentHeading = ({ title, count, colorClass }: { title: string, count: number, colorClass: string }) => (
    <div className={`inline-flex flex-col items-center justify-center p-3 border shadow-sm rounded-lg min-w-[140px] mx-2 mt-4 mb-2 ${colorClass}`}>
      <h3 className="font-bold text-xs uppercase tracking-wider">{title}</h3>
      <span className="text-[10px] mt-1 opacity-80">{count} Member{count !== 1 ? 's' : ''}</span>
    </div>
  );

  const renderDepartments = () => (
    <>
      {sales.length > 0 && (
        <TreeNode label={<DepartmentHeading title="Sales Team" count={sales.length} colorClass="text-purple-600 border-purple-500/30 bg-purple-500/10" />}>
          {sales.map(emp => <TreeNode key={emp.id || emp._id} label={<StyledNode employee={emp} />} />)}
        </TreeNode>
      )}
      {editors.length > 0 && (
        <TreeNode label={<DepartmentHeading title="Creative Editors" count={editors.length} colorClass="text-blue-600 border-blue-500/30 bg-blue-500/10" />}>
          {editors.map(emp => <TreeNode key={emp.id || emp._id} label={<StyledNode employee={emp} />} />)}
        </TreeNode>
      )}
      {shoots.length > 0 && (
        <TreeNode label={<DepartmentHeading title="Production / Shoot" count={shoots.length} colorClass="text-orange-600 border-orange-500/30 bg-orange-500/10" />}>
          {shoots.map(emp => <TreeNode key={emp.id || emp._id} label={<StyledNode employee={emp} />} />)}
        </TreeNode>
      )}
    </>
  );

  return (
    <Card className="w-full overflow-hidden p-6 border border-border/80 bg-card/40 backdrop-blur-md shadow-lg flex justify-center">
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="min-w-max flex justify-center p-4">
          <Tree
            lineWidth="2px"
            lineColor="hsl(var(--border))"
            lineBorderRadius="8px"
            nodePadding="24px"
            label={
              managers.length > 0 ? (
                <div className="flex gap-4 justify-center">
                  {managers.map(manager => (
                    <StyledNode key={manager.id || manager._id} employee={manager} />
                  ))}
                </div>
              ) : (
                <div className="inline-flex flex-col items-center justify-center p-4 border border-border bg-card shadow-sm rounded-lg min-w-[150px]">
                  <h3 className="font-bold text-sm text-foreground">Hogwarts Organization</h3>
                </div>
              )
            }
          >
            {admins.length > 0 ? (
              <TreeNode label={
                <div className="flex gap-4 justify-center mt-4">
                  {admins.map(admin => <StyledNode key={admin.id || admin._id} employee={admin} />)}
                </div>
              }>
                {renderDepartments()}
              </TreeNode>
            ) : (
              renderDepartments()
            )}
          </Tree>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: hsl(var(--secondary));
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--primary) / 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.5);
        }
      `}} />
    </Card>
  );
}
