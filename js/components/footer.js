// Footer Component (Bottom Navigation)
import { router } from '../router.js';

export function renderFooter() {
    const footerDiv = document.getElementById('app-footer');
    const currentPath = window.location.hash.slice(1) || '/feed';
    
    // Don't show footer on login/auth pages
    if (['/', '/login', '/signup'].includes(currentPath)) {
        footerDiv.innerHTML = '';
        return;
    }

    footerDiv.innerHTML = `
        <nav class="navbar navbar-light bg-white border-top fixed-bottom">
            <div class="container-fluid">
                <div class="d-flex justify-content-around w-100">
                    <a href="#/feed" class="nav-link text-center ${currentPath === '/feed' ? 'active' : ''}">
                        <i class="bi bi-house-door${currentPath === '/feed' ? '-fill' : ''} fs-4"></i>
                        <div class="small">Home</div>
                    </a>
                    <a href="#/search" class="nav-link text-center ${currentPath === '/search' ? 'active' : ''}">
                        <i class="bi bi-search${currentPath === '/search' ? '-heart-fill' : ''} fs-4"></i>
                        <div class="small">Search</div>
                    </a>
                    <button class="btn nav-link text-center" data-bs-toggle="modal" data-bs-target="#createPostModal">
                        <i class="bi bi-plus-square fs-4"></i>
                        <div class="small">Post</div>
                    </button>
                    <a href="#/chat" class="nav-link text-center ${currentPath === '/chat' ? 'active' : ''}">
                        <i class="bi bi-chat${currentPath === '/chat' ? '-fill' : ''} fs-4"></i>
                        <div class="small">Chat</div>
                    </a>
                    <a href="#/profile" class="nav-link text-center ${currentPath === '/profile' ? 'active' : ''}">
                        <i class="bi bi-person${currentPath === '/profile' ? '-fill' : ''} fs-4"></i>
                        <div class="small">Profile</div>
                    </a>
                </div>
            </div>
        </nav>
        
        <style>
            .nav-link.active {
                color: #0d6efd !important;
                font-weight: 600;
            }
            body {
                padding-bottom: 70px;
            }
        </style>
    `;
}
