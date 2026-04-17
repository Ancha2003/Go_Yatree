import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Car } from 'lucide-react';

export const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 gradient-bg flex flex-col items-center justify-center p-8 text-white">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
      >
        <Car className="w-12 h-12 text-blue-600" />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold mb-4 tracking-tight">GORIDE</h1>
        <p className="text-blue-100 text-lg mb-12 max-w-[240px] mx-auto leading-relaxed">
          Your reliable companion for every journey, anytime, anywhere.
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full space-y-4"
      >
        <Button 
          className="w-full bg-white text-blue-600 hover:bg-blue-50"
          size="lg"
          onClick={() => navigate('/login')}
        >
          Get Started
        </Button>
      </motion.div>
    </div>
  );
};
