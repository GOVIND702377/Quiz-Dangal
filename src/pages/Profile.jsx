import { Link } from 'react-router-dom';

function Profile() {
  // Placeholder content, update as needed
  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-6 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Profile Page</h2>
        <p>This is your profile. Update this component as needed.</p>
        <Link to="/profile-update" className="text-indigo-600 hover:underline">Update Profile</Link>
      </div>
    </div>
  );
}

export default Profile;
