import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import emailjs from '@emailjs/browser';
@Component({
  selector: 'app-pop-up',
  templateUrl: './pop-up.component.html',
  styleUrls: ['./pop-up.component.css']
})
export class PopUpComponent {

  constructor(private dialog:MatDialog){

  }
  sendMail(mail:string,subject:string,message:string){
    emailjs.send("service_REDACTED","template_REDACTED",{
      subject:subject,
      mail:mail,
      message:message
    },'REDACTED')
    this.dialog.closeAll()
  }
}
