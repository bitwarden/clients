import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "search-bar",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./search-bar.component.html",
  styleUrl: "./search-bar.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent implements AfterViewInit {
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("searchInput") searchInput!: ElementRef<HTMLInputElement>;

  ngAfterViewInit() {
    this.searchInput.nativeElement.focus();
  }
}
