import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  email: string = '';
  password: string = '';
  username: string = '';
  errorMessage: string = '';

  constructor(private http: HttpClient, private router: Router) {}

  registerUser() {
    this.http.post<any>('http://localhost:5000/register', { email: this.email, password: this.password, username: this.username })
      .subscribe(
        response => {
          localStorage.setItem('user', JSON.stringify(response.user));
          this.router.navigate(['/chat']);
        },
        error => {
          this.errorMessage = error.error.error || 'Registration failed';
        }
      );
  }
}
