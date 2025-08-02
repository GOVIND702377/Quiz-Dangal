// A simple Spinner component with a default export

import React from 'react';

export default function Spinner() {
  return (
    <div className="flex justify-center items-center py-4">
      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-900"></div>
    </div>
  );
}
