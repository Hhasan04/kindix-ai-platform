import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  protected email = '';
  protected password = '';
  protected loading = false;
  protected error: string | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  protected submit(): void {
    if (this.loading || !this.email.trim() || !this.password) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.authService.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.authService.storeToken(res.access_token);
        this.loading = false;

        const role = this.authService.getRole();
        if (role === 'admin') {
          this.router.navigateByUrl('/admin');
        } else if (role === 'school') {
          this.router.navigateByUrl('/');
        } else {
          this.error = 'Unrecognized account role.';
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid email or password.';
      },
    });
  }
}
