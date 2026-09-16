import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class RegisterComponent {
  protected schoolName = '';
  protected email = '';
  protected phone = '';
  protected country = '';
  protected password = '';
  protected loading = false;
  protected error: string | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  protected get canSubmit(): boolean {
    return (
      !this.loading &&
      !!this.schoolName.trim() &&
      !!this.email.trim() &&
      !!this.phone.trim() &&
      !!this.country.trim() &&
      !!this.password
    );
  }

  protected submit(): void {
    if (!this.canSubmit) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.authService
      .register({
        schoolName: this.schoolName.trim(),
        email: this.email.trim(),
        phone: this.phone.trim(),
        country: this.country.trim(),
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.authService.storeToken(res.access_token);
          this.loading = false;
          this.router.navigateByUrl('/');
        },
        error: () => {
          this.loading = false;
          this.error = 'Could not register. That email may already be in use.';
        },
      });
  }
}
