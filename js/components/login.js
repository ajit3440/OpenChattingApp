// Login Component
import { auth, db } from '../firebase-config.js';
import { 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { router } from '../router.js';

export async function LoginComponent(container) {
    container.innerHTML = `
        <div class="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
            <div class="card shadow-sm" style="max-width: 400px; width: 100%;">
                <div class="card-body p-4">
                    <h2 class="text-center mb-4">
                        <i class="bi bi-chat-dots-fill me-2"></i>ChatApp
                    </h2>
                    
                    <!-- Login Form -->
                    <div id="login-form">
                        <h5 class="mb-3">Login</h5>
                        <div class="mb-3">
                            <input type="email" class="form-control" id="login-email" placeholder="Email" required>
                        </div>
                        <div class="mb-3">
                            <input type="password" class="form-control" id="login-password" placeholder="Password" required>
                        </div>
                        <button class="btn btn-primary w-100 mb-2" id="login-btn">Login</button>
                        <button class="btn btn-outline-primary w-100 mb-3" id="google-login-btn">
                            <i class="bi bi-google me-2"></i>Login with Google
                        </button>
                        <p class="text-center mb-0">
                            Don't have an account? 
                            <a href="#" id="show-signup">Sign up</a>
                        </p>
                    </div>
                    
                    <!-- Signup Form -->
                    <div id="signup-form" style="display: none;">
                        <h5 class="mb-3">Sign Up</h5>
                        <div class="mb-3">
                            <input type="text" class="form-control" id="signup-name" placeholder="Display Name" required>
                        </div>
                        <div class="mb-3">
                            <input type="email" class="form-control" id="signup-email" placeholder="Email" required>
                        </div>
                        <div class="mb-3">
                            <input type="password" class="form-control" id="signup-password" placeholder="Password" required>
                        </div>
                        <button class="btn btn-primary w-100 mb-2" id="signup-btn">Sign Up</button>
                        <button class="btn btn-outline-primary w-100 mb-3" id="google-signup-btn">
                            <i class="bi bi-google me-2"></i>Sign up with Google
                        </button>
                        <p class="text-center mb-0">
                            Already have an account? 
                            <a href="#" id="show-login">Login</a>
                        </p>
                    </div>
                    
                    <div id="auth-error" class="alert alert-danger mt-3" style="display: none;"></div>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignup);
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleAuth);
    document.getElementById('google-signup-btn').addEventListener('click', handleGoogleAuth);
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
        document.getElementById('auth-error').style.display = 'none';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('auth-error').style.display = 'none';
    });

    // Enter key listeners
    document.getElementById('login-email').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('signup-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignup();
    });
    document.getElementById('signup-email').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignup();
    });
    document.getElementById('signup-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignup();
    });

    async function handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.navigate('/feed');
        } catch (error) {
            showError(error.message);
        }
    }

    async function handleSignup() {
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        if (!name || !email || !password) {
            showError('Please fill in all fields');
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update profile
            await updateProfile(user, {
                displayName: name,
                photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
            });
            
            // Create user document
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                displayName: name,
                email: email,
                photoURL: user.photoURL,
                bio: '',
                followers: [],
                following: [],
                followRequests: [],
                isPrivate: false,
                online: true,
                lastSeen: serverTimestamp(),
                createdAt: serverTimestamp()
            });
            
            router.navigate('/feed');
        } catch (error) {
            showError(error.message);
        }
    }

    async function handleGoogleAuth() {
        const provider = new GoogleAuthProvider();
        
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Create/update user document
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                bio: '',
                followers: [],
                following: [],
                followRequests: [],
                isPrivate: false,
                online: true,
                lastSeen: serverTimestamp(),
                createdAt: serverTimestamp()
            }, { merge: true });
            
            router.navigate('/feed');
        } catch (error) {
            showError(error.message);
        }
    }

    function showError(message) {
        const errorDiv = document.getElementById('auth-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    // Cleanup function
    return () => {
        // No cleanup needed for login component
    };
}
