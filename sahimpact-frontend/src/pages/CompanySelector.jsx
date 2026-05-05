import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

const CompanySelector = () => {
  const { companies, switchCompany, logout, user } = useAuth();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md overflow-hidden">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <Building2 size={32} />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Select Company</CardTitle>
            <CardDescription className="text-lg">
              Welcome back, {user?.full_name || user?.username}. Please select a company context to continue.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            <motion.div 
              variants={container}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2"
            >
              {companies.map((company) => (
                <motion.div key={company.id} variants={item}>
                  <Button
                    variant="outline"
                    className="h-auto w-full p-6 flex flex-col items-start gap-2 text-left hover:border-primary hover:bg-primary/5 group transition-all"
                    onClick={() => switchCompany(company.id)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-semibold text-lg line-clamp-1">{company.name}</span>
                      <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      {company.is_active ? 'Active Account' : 'Inactive'}
                    </span>
                  </Button>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-8 pt-6 border-t flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
                <LogOut size={16} className="mr-2" />
                Sign Out
              </Button>
              <p className="text-xs text-muted-foreground italic">
                SahimPact Multi-Company Governance
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default CompanySelector;
