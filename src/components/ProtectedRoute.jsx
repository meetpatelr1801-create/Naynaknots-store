import {Navigate,useLocation} from "react-router-dom";
export default function ProtectedRoute({user,admin=false,children}){const loc=useLocation();if(!user)return <Navigate to="/login" state={{from:loc.pathname}} replace/>;if(admin&&user.role!=="admin")return <Navigate to="/" replace/>;return children}
