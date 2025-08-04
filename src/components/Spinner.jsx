import React from 'react';
import PropTypes from 'prop-types';

export default function Spinner({ size = 'h-8 w-8', color = 'border-blue-500' }) {
  return (
    <div className="flex justify-center items-center py-4">
      <div
        className={`animate-spin rounded-full ${size} border-t-2 border-b-2 ${color}`}
      ></div>
    </div>
  );
}

Spinner.propTypes = {
  size: PropTypes.string,
  color: PropTypes.string,
};
