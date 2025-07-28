import React from 'react';

// Yeh Admin Panel ka basic structure hai.
// Hum ismein dheere-dheere naye quiz banane ka form jodenge.
export default function Admin() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Admin Panel</h1>
        <p className="text-gray-600">
          Welcome to the Admin Panel. Yahan se aap naye quiz bana sakte hain aur unhe manage kar sakte hain.
        </p>
        {/* Yahan par hum naye quiz banane ka form add karenge */}
      </div>
    </div>
  );
}
